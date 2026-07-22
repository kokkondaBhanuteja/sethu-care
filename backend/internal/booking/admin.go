package booking

// The admin console's read models: the segmented booking list and the full record with its
// transition timeline. Like ListForTechnician these are read-only denormalised views — the
// joins (users, services, addresses, and the review a completed job earned) are display
// data; write ownership of those aggregates stays with their modules.

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

	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// ErrInvalidCursor is returned when a pagination cursor is not one AdminList minted.
var ErrInvalidCursor = errors.New("booking: invalid pagination cursor")

// AdminSegment is the console's three-way split of the thirteen states. There is no
// `scheduled` segment — nothing is future-dated — and `cancelled` also holds FAILED.
type AdminSegment string

const (
	AdminSegmentActive    AdminSegment = "ACTIVE"
	AdminSegmentCompleted AdminSegment = "COMPLETED"
	AdminSegmentCancelled AdminSegment = "CANCELLED"
)

// adminActiveStates is the active segment's membership: everything not terminal-successful
// and not cancelled/failed.
func adminActiveStates() []State {
	return []State{
		StateDraft, StateConfirmed, StateSearching, StateAssigned, StateEnRoute,
		StateArrived, StateInProgress, StateAwaitingCompletion, StateEscalated,
		StateRescheduled,
	}
}

// statesOfSegment maps a segment to its member states. Every state belongs to exactly one
// segment, so the three sets partition AllStates().
func statesOfSegment(segment AdminSegment) ([]State, error) {
	switch segment {
	case AdminSegmentActive, "":
		return adminActiveStates(), nil
	case AdminSegmentCompleted:
		return []State{StateCompleted}, nil
	case AdminSegmentCancelled:
		return []State{StateCancelled, StateFailed}, nil
	}
	return nil, fmt.Errorf("booking: unknown admin segment %q", segment)
}

// AdminListInput is the console's list request.
type AdminListInput struct {
	Segment AdminSegment
	// States narrows within the segment; empty means the whole segment.
	States []State
	// Zone and Service are exact (case-insensitive) matches on city and service name.
	Zone    string
	Service string
	// Search matches customer name, phone, or the booking reference. A non-empty search
	// spans every segment — a search is a search, not a browse.
	Search string
	// SlotFrom (inclusive) and SlotTo (exclusive) bound the promised slot, which falls back
	// to the creation time for immediate jobs.
	SlotFrom *time.Time
	SlotTo   *time.Time
	Limit    int32
	Cursor   string
}

// AdminListItem is one console list row.
type AdminListItem struct {
	BookingID      uuid.UUID
	State          State
	CustomerName   string
	CustomerPhone  string
	ServiceName    string
	City           string
	Amount         money.Money
	SlotAt         time.Time
	CreatedAt      time.Time
	StateSince     time.Time
	TechnicianName *string
	ReviewRating   *int32
}

// AdminSegmentCounts is the segment chip row, computed under the same non-state filters as
// the page itself.
type AdminSegmentCounts struct {
	Active              int32
	Completed           int32
	Cancelled           int32
	ActiveHasEscalation bool
}

// AdminPage is one page of the console's booking list.
type AdminPage struct {
	Items  []AdminListItem
	Counts AdminSegmentCounts
	// Total counts every row the current segment/state filter matches, not this page.
	Total            int32
	IsAcrossSegments bool
	NextCursor       string
}

const defaultAdminListLimit = 20
const maxAdminListLimit = 100

// AdminList returns the console's booking list: segment (or cross-segment search) filtered,
// keyset-paginated newest-created first.
func (service *Service) AdminList(ctx context.Context, in AdminListInput) (AdminPage, error) {
	limit := in.Limit
	if limit <= 0 {
		limit = defaultAdminListLimit
	}
	if limit > maxAdminListLimit {
		limit = maxAdminListLimit
	}

	isAcrossSegments := in.Search != ""
	var segmentStates []State
	if isAcrossSegments {
		segmentStates = AllStates()
	} else {
		var err error
		segmentStates, err = statesOfSegment(in.Segment)
		if err != nil {
			return AdminPage{}, err
		}
	}
	queryStates := intersectStates(segmentStates, in.States)

	searchPattern, referencePrefix := searchParams(in.Search)
	params := sqlcgen.AdminListBookingsParams{
		States:          stateStrings(queryStates),
		Zone:            optionalText(in.Zone),
		ServiceName:     optionalText(in.Service),
		SearchPattern:   searchPattern,
		ReferencePrefix: referencePrefix,
		SlotFrom:        optionalTimestamp(in.SlotFrom),
		SlotTo:          optionalTimestamp(in.SlotTo),
		// One row beyond the page: its presence proves another page exists, so a full final
		// page does not advertise a cursor into nothing.
		RowLimit: limit + 1,
	}
	if in.Cursor != "" {
		cursorCreatedAt, cursorID, err := decodeAdminCursor(in.Cursor)
		if err != nil {
			return AdminPage{}, err
		}
		params.CursorCreatedAt = pgtype.Timestamptz{Time: cursorCreatedAt, Valid: true}
		params.CursorID = &cursorID
	}

	queries := sqlcgen.New(service.pool)
	rows, err := queries.AdminListBookings(ctx, params)
	if err != nil {
		return AdminPage{}, fmt.Errorf("listing bookings for the console: %w", err)
	}
	countRows, err := queries.AdminCountBookingsByState(ctx, sqlcgen.AdminCountBookingsByStateParams{
		Zone:            params.Zone,
		ServiceName:     params.ServiceName,
		SearchPattern:   params.SearchPattern,
		ReferencePrefix: params.ReferencePrefix,
		SlotFrom:        params.SlotFrom,
		SlotTo:          params.SlotTo,
	})
	if err != nil {
		return AdminPage{}, fmt.Errorf("counting bookings for the console: %w", err)
	}

	hasMore := len(rows) > int(limit)
	if hasMore {
		rows = rows[:limit]
	}
	page := AdminPage{
		Items:            make([]AdminListItem, len(rows)),
		IsAcrossSegments: isAcrossSegments,
	}
	for index, row := range rows {
		state, err := ParseState(row.State)
		if err != nil {
			return AdminPage{}, err
		}
		item := AdminListItem{
			BookingID:      row.ID,
			State:          state,
			CustomerName:   row.CustomerName,
			CustomerPhone:  row.CustomerPhone,
			ServiceName:    row.ServiceName,
			City:           row.City,
			Amount:         row.QuotedTotalPaise,
			SlotAt:         row.CreatedAt.Time,
			CreatedAt:      row.CreatedAt.Time,
			StateSince:     row.StateSince.Time,
			TechnicianName: row.TechnicianName,
			ReviewRating:   row.ReviewRating,
		}
		if row.ScheduledFor.Valid {
			item.SlotAt = row.ScheduledFor.Time
		}
		page.Items[index] = item
	}
	if hasMore {
		last := rows[len(rows)-1]
		page.NextCursor = encodeAdminCursor(last.CreatedAt.Time, last.ID)
	}

	byState := make(map[State]int32, len(countRows))
	for _, countRow := range countRows {
		byState[State(countRow.State)] = countRow.Total
	}
	page.Counts = segmentCountsOf(byState)
	for _, state := range queryStates {
		page.Total += byState[state]
	}
	return page, nil
}

func segmentCountsOf(byState map[State]int32) AdminSegmentCounts {
	counts := AdminSegmentCounts{}
	for _, state := range adminActiveStates() {
		counts.Active += byState[state]
	}
	counts.Completed = byState[StateCompleted]
	counts.Cancelled = byState[StateCancelled] + byState[StateFailed]
	counts.ActiveHasEscalation = byState[StateEscalated] > 0
	return counts
}

// intersectStates keeps requested states that belong to the segment; an empty request means
// the whole segment. A requested state outside the segment simply matches nothing.
func intersectStates(segmentStates, requested []State) []State {
	if len(requested) == 0 {
		return segmentStates
	}
	inSegment := make(map[State]bool, len(segmentStates))
	for _, state := range segmentStates {
		inSegment[state] = true
	}
	kept := make([]State, 0, len(requested))
	for _, state := range requested {
		if inSegment[state] {
			kept = append(kept, state)
		}
	}
	return kept
}

func stateStrings(states []State) []string {
	values := make([]string, len(states))
	for index, state := range states {
		values[index] = string(state)
	}
	return values
}

// searchParams turns the console's free-text query into the two SQL match inputs: an ILIKE
// pattern for name/phone, and — when the query looks like a booking reference ("#B-8823AF",
// with or without the decoration) — a lowercase hex prefix matched against the id.
func searchParams(search string) (pattern *string, referencePrefix *string) {
	if search == "" {
		return nil, nil
	}
	like := "%" + search + "%"
	pattern = &like

	candidate := strings.ToLower(strings.TrimSpace(search))
	candidate = strings.TrimPrefix(candidate, "#")
	candidate = strings.TrimPrefix(candidate, "b-")
	if candidate != "" && isHexPrefix(candidate) {
		prefix := candidate + "%"
		referencePrefix = &prefix
	}
	return pattern, referencePrefix
}

func isHexPrefix(candidate string) bool {
	for _, char := range candidate {
		isDigit := char >= '0' && char <= '9'
		isHexLetter := char >= 'a' && char <= 'f'
		if !isDigit && !isHexLetter && char != '-' {
			return false
		}
	}
	return true
}

func optionalText(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func optionalTimestamp(value *time.Time) pgtype.Timestamptz {
	if value == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: *value, Valid: true}
}

func encodeAdminCursor(createdAt time.Time, bookingID uuid.UUID) string {
	raw := fmt.Sprintf("%d|%s", createdAt.UnixNano(), bookingID)
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeAdminCursor(cursor string) (time.Time, uuid.UUID, error) {
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
	bookingID, err := uuid.Parse(parts[1])
	if err != nil {
		return time.Time{}, uuid.Nil, ErrInvalidCursor
	}
	return time.Unix(0, nanos), bookingID, nil
}

// ---------------------------------------------------------------------------
// The full record

// AdminTimelineEntry is one transition in the console's dispatch timeline.
type AdminTimelineEntry struct {
	EventID   uuid.UUID
	Action    Action
	FromState State
	ToState   State
	At        time.Time
	ActorName *string
	ActorRole *string
}

// AdminDetail is the full booking record behind the console's detail screen.
type AdminDetail struct {
	BookingID uuid.UUID
	OrderID   uuid.UUID
	State     State
	// Version is the optimistic-concurrency token mutations must echo back.
	Version   int64
	CreatedAt time.Time
	SlotAt    time.Time
	Amount    money.Money

	CustomerName         string
	CustomerPhone        string
	CustomerSince        time.Time
	CustomerBookingCount int32
	AddressLine1         string
	City                 string
	Pincode              string

	ServiceName string

	TechnicianID     *uuid.UUID
	TechnicianName   *string
	TechnicianRating float64

	Timeline []AdminTimelineEntry
}

// AdminDetailByID reads the full record plus its transition timeline. ErrBookingNotFound
// when the id does not exist.
func (service *Service) AdminDetailByID(ctx context.Context, bookingID uuid.UUID) (AdminDetail, error) {
	queries := sqlcgen.New(service.pool)

	row, err := queries.AdminGetBooking(ctx, bookingID)
	if errors.Is(err, pgx.ErrNoRows) {
		return AdminDetail{}, ErrBookingNotFound
	}
	if err != nil {
		return AdminDetail{}, fmt.Errorf("reading booking for the console: %w", err)
	}
	state, err := ParseState(row.State)
	if err != nil {
		return AdminDetail{}, err
	}

	eventRows, err := queries.AdminGetBookingTimeline(ctx, bookingID)
	if err != nil {
		return AdminDetail{}, fmt.Errorf("reading booking timeline: %w", err)
	}

	detail := AdminDetail{
		BookingID:            row.ID,
		OrderID:              row.OrderID,
		State:                state,
		Version:              row.Version,
		CreatedAt:            row.CreatedAt.Time,
		SlotAt:               row.CreatedAt.Time,
		Amount:               row.QuotedTotalPaise,
		CustomerName:         row.CustomerName,
		CustomerPhone:        row.CustomerPhone,
		CustomerSince:        row.CustomerSince.Time,
		CustomerBookingCount: row.CustomerBookingCount,
		AddressLine1:         row.Line1,
		City:                 row.City,
		Pincode:              row.Pincode,
		ServiceName:          row.ServiceName,
		TechnicianID:         row.TechnicianID,
		TechnicianName:       row.TechnicianName,
		Timeline:             make([]AdminTimelineEntry, len(eventRows)),
	}
	if row.ScheduledFor.Valid {
		detail.SlotAt = row.ScheduledFor.Time
	}
	if rating, err := row.TechnicianRating.Float64Value(); err == nil && rating.Valid {
		detail.TechnicianRating = rating.Float64
	}
	for index, eventRow := range eventRows {
		detail.Timeline[index] = AdminTimelineEntry{
			EventID:   eventRow.ID,
			Action:    Action(eventRow.Action),
			FromState: State(eventRow.FromState),
			ToState:   State(eventRow.ToState),
			At:        eventRow.CreatedAt.Time,
			ActorName: eventRow.ActorName,
			ActorRole: eventRow.ActorRole,
		}
	}
	return detail, nil
}
