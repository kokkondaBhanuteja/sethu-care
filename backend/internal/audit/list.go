package audit

// The read side of the audit log, for the admin console. Record (audit.go) stays a
// package-level function on the caller's transaction; listing needs a pool of its own, so it
// lives on a small Service the transport layer can hold.

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// ErrInvalidCursor is returned when a pagination cursor is not one List minted.
var ErrInvalidCursor = errors.New("audit: invalid pagination cursor")

// ErrEntryNotFound is returned when no entry the console may see carries the requested id.
var ErrEntryNotFound = errors.New("audit: entry not found")

// Service reads the audit log. Writing stays with Record — inside the mutating transaction.
type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// AdminActions is the set of recorded actions the console's audit vocabulary can name:
// booking transitions a human admin drives. Raw strings, not booking.Action — audit is a
// leaf and must not import a domain module; the values are pinned by the audit rows
// themselves, which store the action verbatim.
func AdminActions() []string {
	return []string{"ASSIGN", "CANCEL", "VERIFY_COMPLETION", "SEARCH"}
}

// ListFilter narrows the audit list. Zero values mean "no filter".
type ListFilter struct {
	AdminID *uuid.UUID
	// Action is a raw recorded action (one of AdminActions); empty means all of them.
	Action   string
	TargetID *uuid.UUID
	From     *time.Time
	To       *time.Time
	Limit    int32
	Cursor   string
}

// ListedEntry is one audit row with its admin actor named.
type ListedEntry struct {
	ID         uuid.UUID
	Action     string
	EntityType string
	EntityID   uuid.UUID
	// Before and After are the recorded snapshots flattened to field -> display value.
	Before    map[string]string
	After     map[string]string
	At        time.Time
	AdminID   uuid.UUID
	AdminName string
}

// Page is one page of the audit list plus whole-result-set context.
type Page struct {
	Entries []ListedEntry
	// Total, RangeFrom and RangeTo cover the whole filtered set, not this page.
	Total      int32
	RangeFrom  *time.Time
	RangeTo    *time.Time
	NextCursor string
}

const defaultListLimit = 20
const maxListLimit = 100

// List returns admin-actor audit entries newest first, keyset-paginated.
func (service *Service) List(ctx context.Context, filter ListFilter) (Page, error) {
	limit := filter.Limit
	if limit <= 0 {
		limit = defaultListLimit
	}
	if limit > maxListLimit {
		limit = maxListLimit
	}

	params := sqlcgen.AdminListAuditLogsParams{
		Actions:      AdminActions(),
		AdminFilter:  filter.AdminID,
		EntityFilter: filter.TargetID,
		FromTime:     optionalTimestamp(filter.From),
		ToTime:       optionalTimestamp(filter.To),
		// One row beyond the page: its presence proves another page exists, so a full final
		// page does not advertise a cursor into nothing.
		RowLimit: limit + 1,
	}
	if filter.Action != "" {
		action := filter.Action
		params.ActionFilter = &action
	}
	if filter.Cursor != "" {
		cursorAt, cursorID, err := decodeListCursor(filter.Cursor)
		if err != nil {
			return Page{}, err
		}
		params.CursorCreatedAt = pgtype.Timestamptz{Time: cursorAt, Valid: true}
		params.CursorID = &cursorID
	}

	queries := sqlcgen.New(service.pool)
	rows, err := queries.AdminListAuditLogs(ctx, params)
	if err != nil {
		return Page{}, fmt.Errorf("listing audit entries: %w", err)
	}
	countRow, err := queries.AdminCountAuditLogs(ctx, sqlcgen.AdminCountAuditLogsParams{
		Actions:      params.Actions,
		AdminFilter:  params.AdminFilter,
		ActionFilter: params.ActionFilter,
		EntityFilter: params.EntityFilter,
		FromTime:     params.FromTime,
		ToTime:       params.ToTime,
	})
	if err != nil {
		return Page{}, fmt.Errorf("counting audit entries: %w", err)
	}

	hasMore := len(rows) > int(limit)
	if hasMore {
		rows = rows[:limit]
	}
	page := Page{
		Entries: make([]ListedEntry, len(rows)),
		Total:   countRow.Total,
	}
	if countRow.RangeFrom.Valid {
		rangeFrom := countRow.RangeFrom.Time
		page.RangeFrom = &rangeFrom
	}
	if countRow.RangeTo.Valid {
		rangeTo := countRow.RangeTo.Time
		page.RangeTo = &rangeTo
	}
	for index, row := range rows {
		before, err := flattenSnapshot(row.Before)
		if err != nil {
			return Page{}, fmt.Errorf("decoding before snapshot of %s: %w", row.ID, err)
		}
		after, err := flattenSnapshot(row.After)
		if err != nil {
			return Page{}, fmt.Errorf("decoding after snapshot of %s: %w", row.ID, err)
		}
		page.Entries[index] = ListedEntry{
			ID:         row.ID,
			Action:     row.Action,
			EntityType: row.EntityType,
			EntityID:   row.EntityID,
			Before:     before,
			After:      after,
			At:         row.CreatedAt.Time,
			AdminID:    row.AdminID,
			AdminName:  row.AdminName,
		}
	}
	if hasMore {
		last := rows[len(rows)-1]
		page.NextCursor = encodeListCursor(last.CreatedAt.Time, last.ID)
	}
	return page, nil
}

// Get returns one entry by id, under the SAME visibility rule as List (admin actor, booking
// entity, actions the console vocabulary names) — a deep link can never show more than the
// list would. An id outside that rule is a not-found, indistinguishable from a wrong id.
func (service *Service) Get(ctx context.Context, entryID uuid.UUID) (ListedEntry, error) {
	row, err := sqlcgen.New(service.pool).AdminGetAuditLog(ctx, sqlcgen.AdminGetAuditLogParams{
		ID:      entryID,
		Actions: AdminActions(),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return ListedEntry{}, ErrEntryNotFound
	}
	if err != nil {
		return ListedEntry{}, fmt.Errorf("reading audit entry: %w", err)
	}
	before, err := flattenSnapshot(row.Before)
	if err != nil {
		return ListedEntry{}, fmt.Errorf("decoding before snapshot of %s: %w", row.ID, err)
	}
	after, err := flattenSnapshot(row.After)
	if err != nil {
		return ListedEntry{}, fmt.Errorf("decoding after snapshot of %s: %w", row.ID, err)
	}
	return ListedEntry{
		ID:         row.ID,
		Action:     row.Action,
		EntityType: row.EntityType,
		EntityID:   row.EntityID,
		Before:     before,
		After:      after,
		At:         row.CreatedAt.Time,
		AdminID:    row.AdminID,
		AdminName:  row.AdminName,
	}, nil
}

// AdminActor is one distinct admin present in the log, for the console's filter dropdown.
type AdminActor struct {
	ID   uuid.UUID
	Name string
}

// ListAdmins returns the distinct admin actors the list could ever show — derived here so
// the console never pages the whole ledger to build a filter.
func (service *Service) ListAdmins(ctx context.Context) ([]AdminActor, error) {
	rows, err := sqlcgen.New(service.pool).AdminListAuditActors(ctx, AdminActions())
	if err != nil {
		return nil, fmt.Errorf("listing audit admins: %w", err)
	}
	actors := make([]AdminActor, len(rows))
	for index, row := range rows {
		actors[index] = AdminActor{ID: row.ID, Name: row.Name}
	}
	return actors, nil
}

// flattenSnapshot turns a recorded JSONB snapshot into field -> display string. Values were
// stored as raw domain values; they are stringified, never re-interpreted.
func flattenSnapshot(raw []byte) (map[string]string, error) {
	flattened := map[string]string{}
	if len(raw) == 0 {
		return flattened, nil
	}
	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return nil, err
	}
	for field, value := range decoded {
		switch typed := value.(type) {
		case nil:
			// A null field carries no display value; omit it.
		case string:
			flattened[field] = typed
		case float64:
			flattened[field] = strconv.FormatFloat(typed, 'f', -1, 64)
		case bool:
			flattened[field] = strconv.FormatBool(typed)
		default:
			nested, err := json.Marshal(typed)
			if err != nil {
				return nil, err
			}
			flattened[field] = string(nested)
		}
	}
	return flattened, nil
}

func optionalTimestamp(value *time.Time) pgtype.Timestamptz {
	if value == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: *value, Valid: true}
}

func encodeListCursor(createdAt time.Time, entryID uuid.UUID) string {
	raw := fmt.Sprintf("%d|%s", createdAt.UnixNano(), entryID)
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeListCursor(cursor string) (time.Time, uuid.UUID, error) {
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
	entryID, err := uuid.Parse(parts[1])
	if err != nil {
		return time.Time{}, uuid.Nil, ErrInvalidCursor
	}
	return time.Unix(0, nanos), entryID, nil
}
