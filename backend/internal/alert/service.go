// Package alert is the admin console's alert model: the persisted feed, the acknowledgement
// (ownership) state, the handover notes, and the ENGINE that produces rows from domain events.
//
// THE ENGINE. Alerts are born from the same transactional-outbox stream every other consumer
// reads: internal/app subscribes RecordBookingEscalation to booking.escalated, so a booking
// entering ESCALATED becomes one CRITICAL alert. Delivery is at-least-once, so creation is
// idempotent twice over (the outbox event id is UNIQUE on the row, and only one OPEN alert may
// exist per (kind, subject) — see migration 00019).
//
// THE ID SCHEME. alerts.id is the alert's own uuid. The phase-1 attention queue advertised
// alertId = booking id before this table existed, so every read/write that takes an alert id
// ALSO resolves a subject (booking) uuid to that subject's newest alert — resolveAlertID. New
// clients should pass alerts.id; the fallback keeps the phase-1 convention working.
package alert

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/audit"
	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// ErrAlertNotFound is returned when neither an alert id nor a subject id matches.
var ErrAlertNotFound = errors.New("alert: alert not found")

// ErrInvalidCursor is returned when a pagination cursor is not one List minted.
var ErrInvalidCursor = errors.New("alert: invalid pagination cursor")

// auditActionAcknowledge is the recorded audit action for an acknowledgement. It is written
// against entity_type "alert" inside the same transaction as the acknowledgement itself.
const auditActionAcknowledge = "ALERT_ACKNOWLEDGE"

// Service owns the alerts and alert_notes tables.
type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// ---------------------------------------------------------------------------
// The engine

// RecordBookingEscalation is the outbox consumer for booking.escalated: one CRITICAL,
// acknowledgement-requiring alert per escalation. Idempotent — a redelivered event or an
// already-open escalation alert for the same booking inserts nothing, so at-least-once
// delivery converges.
func (service *Service) RecordBookingEscalation(ctx context.Context, sourceEventID, bookingID uuid.UUID) error {
	subjectKind := SubjectBooking.String()
	_, err := sqlcgen.New(service.pool).InsertSubjectAlert(ctx, sqlcgen.InsertSubjectAlertParams{
		Kind:                    KindBookingEscalated.String(),
		Severity:                SeverityCritical.String(),
		SubjectKind:             &subjectKind,
		SubjectID:               &bookingID,
		SourceEventID:           &sourceEventID,
		RequiresAcknowledgement: true,
	})
	if err != nil {
		return fmt.Errorf("recording escalation alert: %w", err)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Reading the feed

// Acknowledgement is who owns an alert, and since when.
type Acknowledgement struct {
	AdminID   uuid.UUID
	AdminName string
	At        time.Time
}

// ListedAlert is one feed row with the read-time context the console interpolates from.
type ListedAlert struct {
	ID                      uuid.UUID
	Kind                    Kind
	Severity                Severity
	SubjectKind             *SubjectKind
	SubjectID               *uuid.UUID
	RequiresAcknowledgement bool
	Acknowledgement         *Acknowledgement
	// ServiceName and City are joined from the subject booking; empty when there is none.
	ServiceName string
	City        string
	CreatedAt   time.Time
}

// Filter narrows the feed. Nil fields mean "no filter".
type Filter struct {
	Severity     *Severity
	Acknowledged *bool
	Limit        int32
	Cursor       string
}

// Page is one page of the feed plus the whole-filtered-set total.
type Page struct {
	Alerts     []ListedAlert
	Total      int32
	NextCursor string
}

const defaultListLimit = 20
const maxListLimit = 100

// List returns the feed newest first, keyset-paginated.
func (service *Service) List(ctx context.Context, filter Filter) (Page, error) {
	limit := filter.Limit
	if limit <= 0 {
		limit = defaultListLimit
	}
	if limit > maxListLimit {
		limit = maxListLimit
	}

	params := sqlcgen.ListAlertsParams{
		// One row beyond the page proves another page exists, so a full final page does
		// not advertise a cursor into nothing.
		RowLimit: limit + 1,
	}
	if filter.Severity != nil {
		severity := filter.Severity.String()
		params.SeverityFilter = &severity
	}
	params.AcknowledgedFilter = filter.Acknowledged
	if filter.Cursor != "" {
		cursorAt, cursorID, err := decodeFeedCursor(filter.Cursor)
		if err != nil {
			return Page{}, err
		}
		params.CursorCreatedAt = pgtype.Timestamptz{Time: cursorAt, Valid: true}
		params.CursorID = &cursorID
	}

	queries := sqlcgen.New(service.pool)
	rows, err := queries.ListAlerts(ctx, params)
	if err != nil {
		return Page{}, fmt.Errorf("listing alerts: %w", err)
	}
	total, err := queries.CountAlerts(ctx, sqlcgen.CountAlertsParams{
		SeverityFilter:     params.SeverityFilter,
		AcknowledgedFilter: params.AcknowledgedFilter,
	})
	if err != nil {
		return Page{}, fmt.Errorf("counting alerts: %w", err)
	}

	hasMore := len(rows) > int(limit)
	if hasMore {
		rows = rows[:limit]
	}
	page := Page{Alerts: make([]ListedAlert, len(rows)), Total: total}
	for index, row := range rows {
		listed, err := listedAlertOf(
			row.ID, row.Kind, row.Severity, row.SubjectKind, row.SubjectID,
			row.RequiresAcknowledgement, row.AcknowledgedBy, row.AcknowledgedAt,
			row.AcknowledgerName, row.ServiceName, row.City, row.CreatedAt)
		if err != nil {
			return Page{}, err
		}
		page.Alerts[index] = listed
	}
	if hasMore {
		last := rows[len(rows)-1]
		page.NextCursor = encodeFeedCursor(last.CreatedAt.Time, last.ID)
	}
	return page, nil
}

// listedAlertOf shapes one row's raw columns, validating the persisted vocabularies at the
// read boundary.
func listedAlertOf(
	id uuid.UUID, rawKind, rawSeverity string, rawSubjectKind *string, subjectID *uuid.UUID,
	requiresAcknowledgement bool, acknowledgedBy *uuid.UUID, acknowledgedAt pgtype.Timestamptz,
	acknowledgerName, serviceName, city *string, createdAt pgtype.Timestamptz,
) (ListedAlert, error) {
	kind, err := ParseKind(rawKind)
	if err != nil {
		return ListedAlert{}, err
	}
	severity, err := ParseSeverity(rawSeverity)
	if err != nil {
		return ListedAlert{}, err
	}
	listed := ListedAlert{
		ID:                      id,
		Kind:                    kind,
		Severity:                severity,
		SubjectID:               subjectID,
		RequiresAcknowledgement: requiresAcknowledgement,
		ServiceName:             stringOrEmpty(serviceName),
		City:                    stringOrEmpty(city),
		CreatedAt:               createdAt.Time,
	}
	if rawSubjectKind != nil {
		subjectKind, err := ParseSubjectKind(*rawSubjectKind)
		if err != nil {
			return ListedAlert{}, err
		}
		listed.SubjectKind = &subjectKind
	}
	if acknowledgedBy != nil && acknowledgedAt.Valid {
		listed.Acknowledgement = &Acknowledgement{
			AdminID:   *acknowledgedBy,
			AdminName: stringOrEmpty(acknowledgerName),
			At:        acknowledgedAt.Time,
		}
	}
	return listed, nil
}

func stringOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

// ---------------------------------------------------------------------------
// Detail

// RelatedAlert is another alert about the same subject.
type RelatedAlert struct {
	ID        uuid.UUID
	Kind      Kind
	Severity  Severity
	CreatedAt time.Time
}

// HistoryEntry is one transition of the subject booking — state CODES, never composed prose.
type HistoryEntry struct {
	ID        uuid.UUID
	Action    string
	FromState string
	ToState   string
	At        time.Time
}

// Note is one handover note.
type Note struct {
	ID         uuid.UUID
	Body       string
	AuthorName string
	CreatedAt  time.Time
}

// Detail is one alert with everything its screen renders.
type Detail struct {
	ListedAlert
	// Booking-subject context; zero values when the alert has no booking subject.
	CustomerName     string
	BookingState     string
	BookingAmount    money.Money
	BookingCreatedAt time.Time
	// EscalatedFrom is the state the booking escalated OUT of — the trigger's "actual".
	// Empty when unknown (no escalation event on record).
	EscalatedFrom string

	RelatedAlerts []RelatedAlert
	History       []HistoryEntry
	Notes         []Note
}

// Get returns one alert's detail. The id may be the alert's own id or — the phase-1
// convention — the subject booking's id, which resolves to that booking's newest alert.
func (service *Service) Get(ctx context.Context, rawID uuid.UUID) (Detail, error) {
	queries := sqlcgen.New(service.pool)
	row, err := service.resolveAlert(ctx, queries, rawID)
	if err != nil {
		return Detail{}, err
	}

	listed, err := listedAlertOf(
		row.ID, row.Kind, row.Severity, row.SubjectKind, row.SubjectID,
		row.RequiresAcknowledgement, row.AcknowledgedBy, row.AcknowledgedAt,
		row.AcknowledgerName, row.ServiceName, row.City, row.CreatedAt)
	if err != nil {
		return Detail{}, err
	}
	detail := Detail{
		ListedAlert:      listed,
		CustomerName:     stringOrEmpty(row.CustomerName),
		BookingState:     stringOrEmpty(row.BookingState),
		BookingAmount:    row.BookingTotalPaise,
		BookingCreatedAt: row.BookingCreatedAt.Time,
		RelatedAlerts:    []RelatedAlert{},
		History:          []HistoryEntry{},
		Notes:            []Note{},
	}

	if row.SubjectID != nil {
		related, err := queries.ListAlertsBySubject(ctx, sqlcgen.ListAlertsBySubjectParams{
			SubjectID: row.SubjectID, ExcludingID: row.ID,
		})
		if err != nil {
			return Detail{}, fmt.Errorf("listing related alerts: %w", err)
		}
		for _, sibling := range related {
			kind, err := ParseKind(sibling.Kind)
			if err != nil {
				return Detail{}, err
			}
			severity, err := ParseSeverity(sibling.Severity)
			if err != nil {
				return Detail{}, err
			}
			detail.RelatedAlerts = append(detail.RelatedAlerts, RelatedAlert{
				ID: sibling.ID, Kind: kind, Severity: severity, CreatedAt: sibling.CreatedAt.Time,
			})
		}
	}

	if listed.SubjectKind != nil && *listed.SubjectKind == SubjectBooking && row.SubjectID != nil {
		history, err := queries.ListAlertSubjectHistory(ctx, *row.SubjectID)
		if err != nil {
			return Detail{}, fmt.Errorf("listing alert history: %w", err)
		}
		for _, event := range history {
			detail.History = append(detail.History, HistoryEntry{
				ID: event.ID, Action: event.Action,
				FromState: event.FromState, ToState: event.ToState,
				At: event.CreatedAt.Time,
			})
		}
		escalation, err := queries.GetAlertEscalationContext(ctx, *row.SubjectID)
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			// A seed-born alert whose booking never recorded the transition; the trigger
			// simply cannot name the prior state.
		case err != nil:
			return Detail{}, fmt.Errorf("reading escalation context: %w", err)
		default:
			detail.EscalatedFrom = escalation.FromState
		}
	}

	notes, err := queries.ListAlertNotes(ctx, row.ID)
	if err != nil {
		return Detail{}, fmt.Errorf("listing alert notes: %w", err)
	}
	for _, note := range notes {
		detail.Notes = append(detail.Notes, Note{
			ID: note.ID, Body: note.Body, AuthorName: note.AuthorName, CreatedAt: note.CreatedAt.Time,
		})
	}
	return detail, nil
}

// resolveAlert loads by alerts.id first, then by the phase-1 subject-id convention.
func (service *Service) resolveAlert(ctx context.Context, queries *sqlcgen.Queries, rawID uuid.UUID) (sqlcgen.GetAlertRow, error) {
	row, err := queries.GetAlert(ctx, rawID)
	if err == nil {
		return row, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return sqlcgen.GetAlertRow{}, fmt.Errorf("reading alert: %w", err)
	}

	subjectID := rawID
	alertID, err := queries.GetNewestAlertIDBySubject(ctx, &subjectID)
	if errors.Is(err, pgx.ErrNoRows) {
		return sqlcgen.GetAlertRow{}, ErrAlertNotFound
	}
	if err != nil {
		return sqlcgen.GetAlertRow{}, fmt.Errorf("resolving alert by subject: %w", err)
	}
	row, err = queries.GetAlert(ctx, alertID)
	if err != nil {
		return sqlcgen.GetAlertRow{}, fmt.Errorf("reading alert %s: %w", alertID, err)
	}
	return row, nil
}

// ---------------------------------------------------------------------------
// Acknowledging

// Acknowledge claims an alert for an admin. First writer wins IN THE DATABASE; a replay by
// the winner and a late second admin both succeed, distinguished by wonRace. The audit entry
// is written inside the same transaction as the acknowledgement — they commit together or
// not at all.
func (service *Service) Acknowledge(ctx context.Context, rawID, adminID uuid.UUID) (ListedAlert, bool, error) {
	queries := sqlcgen.New(service.pool)
	row, err := service.resolveAlert(ctx, queries, rawID)
	if err != nil {
		return ListedAlert{}, false, err
	}

	wonRace := false
	err = storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		txQueries := sqlcgen.New(tx)
		_, ackErr := txQueries.AcknowledgeAlert(ctx, sqlcgen.AcknowledgeAlertParams{
			AdminID: &adminID, ID: row.ID,
		})
		switch {
		case errors.Is(ackErr, pgx.ErrNoRows):
			// Somebody already owns it (possibly this very admin replaying); no audit row.
			return nil
		case ackErr != nil:
			return fmt.Errorf("acknowledging alert: %w", ackErr)
		}
		wonRace = true
		return audit.Record(ctx, tx, audit.Entry{
			ActorUserID: &adminID,
			Action:      auditActionAcknowledge,
			EntityType:  "alert",
			EntityID:    row.ID,
			Before:      map[string]any{"acknowledged": false},
			After:       map[string]any{"acknowledged": true, "acknowledged_by": adminID},
		})
	})
	if err != nil {
		return ListedAlert{}, false, err
	}

	// Re-read for the winning acknowledgement (ours or the earlier admin's).
	afterRow, err := queries.GetAlert(ctx, row.ID)
	if err != nil {
		return ListedAlert{}, false, fmt.Errorf("re-reading acknowledged alert: %w", err)
	}
	listed, err := listedAlertOf(
		afterRow.ID, afterRow.Kind, afterRow.Severity, afterRow.SubjectKind, afterRow.SubjectID,
		afterRow.RequiresAcknowledgement, afterRow.AcknowledgedBy, afterRow.AcknowledgedAt,
		afterRow.AcknowledgerName, afterRow.ServiceName, afterRow.City, afterRow.CreatedAt)
	if err != nil {
		return ListedAlert{}, false, err
	}
	// A replay by the admin who already owns the alert also "won": the console must render
	// ownership, not a race lost to oneself.
	if !wonRace && listed.Acknowledgement != nil && listed.Acknowledgement.AdminID == adminID {
		wonRace = true
	}
	return listed, wonRace, nil
}

// ReadAll marks the informational tier read and reports how many rows it touched. The SQL
// itself refuses to touch anything requiring acknowledgement — read-all must never silence a
// critical. Naturally idempotent: a replay finds nothing left unread and reports zero.
func (service *Service) ReadAll(ctx context.Context) (int32, error) {
	marked, err := sqlcgen.New(service.pool).MarkInformationalAlertsRead(ctx)
	if err != nil {
		return 0, fmt.Errorf("marking alerts read: %w", err)
	}
	return int32(marked), nil
}

// ---------------------------------------------------------------------------
// Notes

// AddNote appends a handover note. Replay-safe on (alert, author, idempotency key): the
// retried request returns the first attempt's note instead of writing a second.
func (service *Service) AddNote(ctx context.Context, rawID, authorID uuid.UUID, idempotencyKey, body string) (Note, error) {
	queries := sqlcgen.New(service.pool)
	row, err := service.resolveAlert(ctx, queries, rawID)
	if err != nil {
		return Note{}, err
	}

	if err := queries.InsertAlertNote(ctx, sqlcgen.InsertAlertNoteParams{
		AlertID:        row.ID,
		AuthorUserID:   authorID,
		IdempotencyKey: idempotencyKey,
		Body:           body,
	}); err != nil {
		return Note{}, fmt.Errorf("writing alert note: %w", err)
	}
	stored, err := queries.GetAlertNoteByKey(ctx, sqlcgen.GetAlertNoteByKeyParams{
		AlertID:        row.ID,
		AuthorUserID:   authorID,
		IdempotencyKey: idempotencyKey,
	})
	if err != nil {
		return Note{}, fmt.Errorf("reading back alert note: %w", err)
	}
	return Note{ID: stored.ID, Body: stored.Body, AuthorName: stored.AuthorName, CreatedAt: stored.CreatedAt.Time}, nil
}

// ---------------------------------------------------------------------------
// The band and the badge

// BandExample is one of the band's example refs.
type BandExample struct {
	AlertID   uuid.UUID
	Kind      Kind
	SubjectID *uuid.UUID
	CreatedAt time.Time
}

// Band is the dashboard's critical-escalations band.
type Band struct {
	OpenCritical int32
	Examples     []BandExample
}

// bandExampleLimit is "at most two, by design: the band is a pointer into the queue, not the
// queue" (the admin contract).
const bandExampleLimit = 2

// Band returns the unacknowledged-critical count and the newest examples.
func (service *Service) Band(ctx context.Context) (Band, error) {
	queries := sqlcgen.New(service.pool)
	openCritical, err := queries.CountOpenCriticalAlerts(ctx)
	if err != nil {
		return Band{}, fmt.Errorf("counting open criticals: %w", err)
	}
	rows, err := queries.ListOpenCriticalAlertExamples(ctx, bandExampleLimit)
	if err != nil {
		return Band{}, fmt.Errorf("listing band examples: %w", err)
	}
	band := Band{OpenCritical: openCritical, Examples: make([]BandExample, len(rows))}
	for index, row := range rows {
		kind, err := ParseKind(row.Kind)
		if err != nil {
			return Band{}, err
		}
		band.Examples[index] = BandExample{
			AlertID: row.ID, Kind: kind, SubjectID: row.SubjectID, CreatedAt: row.CreatedAt.Time,
		}
	}
	return band, nil
}

// CountOpenCritical is the shell badge: unacknowledged criticals only.
func (service *Service) CountOpenCritical(ctx context.Context) (int32, error) {
	count, err := sqlcgen.New(service.pool).CountOpenCriticalAlerts(ctx)
	if err != nil {
		return 0, fmt.Errorf("counting open criticals: %w", err)
	}
	return count, nil
}

// ---------------------------------------------------------------------------
// Cursors

func encodeFeedCursor(createdAt time.Time, alertID uuid.UUID) string {
	raw := fmt.Sprintf("%d|%s", createdAt.UnixNano(), alertID)
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeFeedCursor(cursor string) (time.Time, uuid.UUID, error) {
	raw, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return time.Time{}, uuid.Nil, ErrInvalidCursor
	}
	parts := strings.SplitN(string(raw), "|", 2)
	if len(parts) != 2 {
		return time.Time{}, uuid.Nil, ErrInvalidCursor
	}
	nanos, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return time.Time{}, uuid.Nil, ErrInvalidCursor
	}
	alertID, err := uuid.Parse(parts[1])
	if err != nil {
		return time.Time{}, uuid.Nil, ErrInvalidCursor
	}
	return time.Unix(0, nanos), alertID, nil
}
