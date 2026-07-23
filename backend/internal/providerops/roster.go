package providerops

// The provider roster read model: derived live statuses, segment counts, keyset pagination
// and the supply-health shortfall.

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// staleAfterSeconds is how long an online technician may go unseen (no availability toggle,
// no location ping) before the roster stops calling them free. Mirrors the console's
// staleness treatment of live statuses.
const staleAfterSeconds = 15 * 60

// reportingNowWindow is how recent the last signal must be for the roster to say
// "reporting right now" (a null lastSeenAt) instead of a timestamp.
const reportingNowWindow = time.Minute

// zoneOnlineThreshold is the platform default for how many online providers a zone needs
// before the console shows a supply shortfall. There is no per-zone configuration yet, so
// one honest default stands in until zones carry their own thresholds.
const zoneOnlineThreshold = 3

// istZone finds "today" the way the business day runs, matching internal/ops.
var istZone = time.FixedZone("IST", 5*3600+30*60)

// istDayStart is midnight IST of the current business day.
func istDayStart(now time.Time) time.Time {
	year, month, day := now.In(istZone).Date()
	return time.Date(year, month, day, 0, 0, 0, 0, istZone)
}

// istCycleStart is the start of the current calendar month IST — the "payout cycle" the
// profile's cycle figure covers (technicians are salaried; the figure is the revenue their
// completed jobs earned the platform this cycle, not money owed to them).
func istCycleStart(now time.Time) time.Time {
	year, month, _ := now.In(istZone).Date()
	return time.Date(year, month, 1, 0, 0, 0, 0, istZone)
}

// RosterSegment is the console's three-way slice of the roster.
type RosterSegment string

const (
	RosterOnline RosterSegment = "online"
	RosterOnJob  RosterSegment = "onJob"
	RosterAll    RosterSegment = "all"
)

// statusesOfSegment maps a segment to the derived statuses it shows. online means free —
// dispatchable right now; the on-job crowd has its own segment and count.
func statusesOfSegment(segment RosterSegment) ([]string, error) {
	switch segment {
	case RosterOnline, "":
		return []string{string(ProviderFree)}, nil
	case RosterOnJob:
		return []string{string(ProviderOnJob)}, nil
	case RosterAll:
		return []string{}, nil // empty = no status filter
	}
	return nil, fmt.Errorf("providerops: unknown roster segment %q", segment)
}

// RosterInput is the console's roster request.
type RosterInput struct {
	Segment RosterSegment
	// Search matches name, phone and zone, case-insensitively.
	Search string
	Limit  int32
	Cursor string
}

// CurrentJob is the stage cell of a roster row.
type CurrentJob struct {
	BookingID uuid.UUID
	Stage     JobStage
}

// RosterRow is one provider on the roster.
type RosterRow struct {
	ID     uuid.UUID
	Name   string
	Status ProviderStatus
	Skills []string
	Zone   string
	// JobsToday is jobs completed today plus jobs live right now.
	JobsToday          int32
	EarningsTodayPaise int64
	Rating             float64
	// CompletionRate is completed / terminal over the last 90 days (0 when no terminal jobs).
	CompletionRate float64
	// LastSeenAt is nil when the provider reported within the last minute.
	LastSeenAt     *time.Time
	CurrentJob     *CurrentJob
	SuspendedUntil *time.Time
}

// RosterCounts is the segment chip row, computed under the same search filter as the page.
type RosterCounts struct {
	Total     int32
	Online    int32
	OnJob     int32
	Suspended int32
}

// ZoneSupply is one zone's online headcount against its threshold.
type ZoneSupply struct {
	Zone        string
	OnlineCount int32
	Threshold   int32
}

// RosterPage is one page of the roster plus the whole-roster context around it.
type RosterPage struct {
	Rows   []RosterRow
	Counts RosterCounts
	// Shortfall is the worst zone below threshold, or nil when every zone is at or above it.
	Shortfall *ZoneSupply
	// PendingApplications counts undecided applications; OldestApplicationDays ages the
	// oldest of them against the 48-hour SLA.
	PendingApplications   int32
	OldestApplicationDays int32
	// Total counts every provider the current segment + search matches, not this page.
	Total        int32
	NextCursor   string
	StatusesAsOf time.Time
}

const defaultRosterLimit = 20
const maxRosterLimit = 100

// Roster returns the provider roster: statuses derived live (standing, active bookings,
// availability, location freshness), keyset-paginated by (name, id).
func (service *Service) Roster(ctx context.Context, in RosterInput) (RosterPage, error) {
	limit := in.Limit
	if limit <= 0 {
		limit = defaultRosterLimit
	}
	if limit > maxRosterLimit {
		limit = maxRosterLimit
	}

	statuses, err := statusesOfSegment(in.Segment)
	if err != nil {
		return RosterPage{}, err
	}

	now := time.Now()
	params := sqlcgen.AdminListProviderRosterParams{
		StaleAfterSeconds: staleAfterSeconds,
		TodayStart:        pgtype.Timestamptz{Time: istDayStart(now), Valid: true},
		Statuses:          statuses,
		SearchPattern:     searchPattern(in.Search),
		// One row beyond the page proves another page exists, so a full final page does
		// not advertise a cursor into nothing.
		RowLimit: limit + 1,
	}
	if in.Cursor != "" {
		cursorName, cursorID, err := decodeRosterCursor(in.Cursor)
		if err != nil {
			return RosterPage{}, err
		}
		params.CursorName = &cursorName
		params.CursorID = &cursorID
	}

	queries := sqlcgen.New(service.pool)
	rows, err := queries.AdminListProviderRoster(ctx, params)
	if err != nil {
		return RosterPage{}, fmt.Errorf("listing the provider roster: %w", err)
	}

	hasMore := len(rows) > int(limit)
	if hasMore {
		rows = rows[:limit]
	}

	pageIDs := make([]uuid.UUID, len(rows))
	for index, row := range rows {
		pageIDs[index] = row.UserID
	}
	currentJobs, err := queries.AdminProviderCurrentJobs(ctx, pageIDs)
	if err != nil {
		return RosterPage{}, fmt.Errorf("reading current jobs: %w", err)
	}
	jobByTechnician := make(map[uuid.UUID]*CurrentJob, len(currentJobs))
	for _, jobRow := range currentJobs {
		if jobRow.TechnicianID == nil {
			continue
		}
		jobByTechnician[*jobRow.TechnicianID] = &CurrentJob{
			BookingID: jobRow.ID,
			Stage:     stageOfState(jobRow.State),
		}
	}

	page := RosterPage{
		Rows:         make([]RosterRow, len(rows)),
		StatusesAsOf: now.UTC(),
	}
	for index, row := range rows {
		rosterRow := RosterRow{
			ID:                 row.UserID,
			Name:               row.Name,
			Status:             ProviderStatus(row.Status),
			Skills:             row.Skills,
			Zone:               row.Zone,
			JobsToday:          row.CompletedToday + row.ActiveJobs,
			EarningsTodayPaise: row.EarningsToday,
			Rating:             numericToFloat(row.Rating),
			CurrentJob:         jobByTechnician[row.UserID],
		}
		if row.Terminal90 > 0 {
			rosterRow.CompletionRate = float64(row.Completed90) / float64(row.Terminal90)
		}
		if row.LastSeenAt.Valid && now.Sub(row.LastSeenAt.Time) > reportingNowWindow {
			lastSeen := row.LastSeenAt.Time
			rosterRow.LastSeenAt = &lastSeen
		}
		if row.SuspendedUntil.Valid && rosterRow.Status == ProviderSuspended {
			until := row.SuspendedUntil.Time
			rosterRow.SuspendedUntil = &until
		}
		page.Rows[index] = rosterRow
	}
	if hasMore {
		last := rows[len(rows)-1]
		page.NextCursor = encodeRosterCursor(last.Name, last.UserID)
	}

	countRows, err := queries.AdminCountProviderRoster(ctx, sqlcgen.AdminCountProviderRosterParams{
		StaleAfterSeconds: staleAfterSeconds,
		SearchPattern:     params.SearchPattern,
	})
	if err != nil {
		return RosterPage{}, fmt.Errorf("counting the provider roster: %w", err)
	}
	byStatus := make(map[string]int32, len(countRows))
	for _, countRow := range countRows {
		byStatus[countRow.Status] = countRow.Total
		page.Counts.Total += countRow.Total
	}
	page.Counts.Online = byStatus[string(ProviderFree)]
	page.Counts.OnJob = byStatus[string(ProviderOnJob)]
	page.Counts.Suspended = byStatus[string(ProviderSuspended)]
	if len(statuses) == 0 {
		page.Total = page.Counts.Total
	} else {
		for _, status := range statuses {
			page.Total += byStatus[status]
		}
	}

	zoneRows, err := queries.AdminZoneOnlineCounts(ctx, staleAfterSeconds)
	if err != nil {
		return RosterPage{}, fmt.Errorf("reading zone supply: %w", err)
	}
	page.Shortfall = worstShortfall(zoneRows)

	summary, err := queries.AdminApplicationsSummary(ctx)
	if err != nil {
		return RosterPage{}, fmt.Errorf("reading applications summary: %w", err)
	}
	page.PendingApplications = summary.Pending + summary.AwaitingDocs
	if summary.OldestUndecidedAt.Valid {
		page.OldestApplicationDays = int32(now.Sub(summary.OldestUndecidedAt.Time).Hours() / 24)
	}

	return page, nil
}

// worstShortfall picks the zone furthest below the threshold, or nil when every zone is at
// or above it. Ties go to the first zone alphabetically (the rows arrive ordered).
func worstShortfall(zoneRows []sqlcgen.AdminZoneOnlineCountsRow) *ZoneSupply {
	var worst *ZoneSupply
	for _, zoneRow := range zoneRows {
		if zoneRow.OnlineCount >= zoneOnlineThreshold {
			continue
		}
		if worst == nil || zoneRow.OnlineCount < worst.OnlineCount {
			worst = &ZoneSupply{
				Zone:        zoneRow.Zone,
				OnlineCount: zoneRow.OnlineCount,
				Threshold:   zoneOnlineThreshold,
			}
		}
	}
	return worst
}

// stageOfState collapses the five live booking states into the console's two-stage
// vocabulary: anything before arrival reads en_route, anything on site in_progress.
func stageOfState(state string) JobStage {
	switch state {
	case "ASSIGNED", "EN_ROUTE":
		return JobStageEnRoute
	default:
		return JobStageInProgress
	}
}

func searchPattern(search string) *string {
	if search == "" {
		return nil
	}
	pattern := "%" + search + "%"
	return &pattern
}

func numericToFloat(value pgtype.Numeric) float64 {
	converted, err := value.Float64Value()
	if err != nil || !converted.Valid {
		return 0
	}
	return converted.Float64
}

func encodeRosterCursor(name string, technicianID uuid.UUID) string {
	// The id leads because it is fixed-width; the name may contain any character.
	raw := technicianID.String() + "|" + name
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeRosterCursor(cursor string) (name string, technicianID uuid.UUID, err error) {
	raw, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return "", uuid.Nil, ErrInvalidCursor
	}
	parts := strings.SplitN(string(raw), "|", 2)
	if len(parts) != 2 {
		return "", uuid.Nil, ErrInvalidCursor
	}
	technicianID, err = uuid.Parse(parts[0])
	if err != nil {
		return "", uuid.Nil, ErrInvalidCursor
	}
	return parts[1], technicianID, nil
}
