package ops

// The admin console's live-dashboard reads: the needs-attention queue, the activity feed and
// the headline KPIs. Like the assignment queue these are cross-module READ models — ops owns
// no aggregate and never writes another domain's tables; it composes what the console shows
// from bookings, booking_events and (read-only) the ledger's REVENUE rows.

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

// ErrInvalidCursor is returned when a pagination cursor is not one this service minted.
var ErrInvalidCursor = errors.New("ops: invalid pagination cursor")

// sparklinePoints is the number of buckets every dashboard sparkline carries, per the admin
// contract ("eight points per metric").
const sparklinePoints = 8

// istOffset is IST as a fixed zone (+05:30, no DST) — used to find "today" the way the
// business day runs, matching the Asia/Kolkata arithmetic the dispatch queries use.
var istZone = time.FixedZone("IST", 5*3600+30*60)

// ---------------------------------------------------------------------------
// Needs-attention queue

// AttentionPriority is the server-side diagnosis of why a booking is in the queue. Only the
// diagnoses the platform can actually make today exist here; the SLA / no-response tiers
// arrive with the alert engine.
type AttentionPriority string

const (
	// AttentionEscalated is a booking a technician or the system handed to a human.
	AttentionEscalated AttentionPriority = "ESCALATED"
	// AttentionFailedAssignment is a SEARCHING booking no assignment has landed on yet.
	AttentionFailedAssignment AttentionPriority = "FAILED_ASSIGNMENT"
)

// AttentionFilter narrows the queue to one diagnosis family.
type AttentionFilter string

const (
	AttentionFilterAll        AttentionFilter = "ALL"
	AttentionFilterEscalated  AttentionFilter = "ESCALATED"
	AttentionFilterUnassigned AttentionFilter = "UNASSIGNED"
	// AttentionFilterSLA and AttentionFilterDelayed are declared for the console's chip row
	// but always match nothing: no SLA engine exists yet, so claiming members would lie.
	AttentionFilterSLA     AttentionFilter = "SLA"
	AttentionFilterDelayed AttentionFilter = "DELAYED"
)

// AttentionItem is one queue row with the context the console renders.
type AttentionItem struct {
	BookingID    uuid.UUID
	State        string
	Priority     AttentionPriority
	CustomerName string
	ServiceName  string
	City         string
	Amount       money.Money
	// SlotAt is the promised slot, falling back to creation time for immediate jobs.
	SlotAt time.Time
	// SurfacedAt is when the booking entered its current (problem) state.
	SurfacedAt time.Time
	CreatedAt  time.Time
}

// AttentionCounts is the per-filter membership across the WHOLE queue, for the chip row.
type AttentionCounts struct {
	All        int32
	Escalated  int32
	Unassigned int32
	SLA        int32
	Delayed    int32
}

// AttentionClear names the last time an admin cleared something from the queue.
type AttentionClear struct {
	AdminName string
	BookingID uuid.UUID
	At        time.Time
}

// AttentionQueueResult is one page of the queue plus the whole-queue context around it.
type AttentionQueueResult struct {
	Items       []AttentionItem
	Counts      AttentionCounts
	HealthyJobs int32
	// LastCleared is populated only when the queue is empty — the all-clear state cites it.
	LastCleared *AttentionClear
	// Total is the whole queue across every filter, not the filtered count.
	Total      int32
	NextCursor string
	UpdatedAt  time.Time
}

// AttentionQueue returns the needs-attention queue in the server-owned priority order:
// ESCALATED first, oldest-surfaced first within a tier. The whole queue is read every time —
// the chip counts must cover every filter regardless of the one applied — and the requested
// page is sliced out of it.
func (service *Service) AttentionQueue(ctx context.Context, filter AttentionFilter, limit int32, cursor string) (AttentionQueueResult, error) {
	queries := sqlcgen.New(service.pool)

	rows, err := queries.ListAttentionQueue(ctx)
	if err != nil {
		return AttentionQueueResult{}, fmt.Errorf("reading attention queue: %w", err)
	}
	healthy, err := queries.CountHealthyJobs(ctx)
	if err != nil {
		return AttentionQueueResult{}, fmt.Errorf("counting healthy jobs: %w", err)
	}

	all := make([]AttentionItem, len(rows))
	counts := AttentionCounts{All: int32(len(rows))}
	for index, row := range rows {
		item := AttentionItem{
			BookingID:    row.ID,
			State:        row.State,
			Priority:     AttentionFailedAssignment,
			CustomerName: row.CustomerName,
			ServiceName:  row.ServiceName,
			City:         row.City,
			Amount:       row.QuotedTotalPaise,
			SlotAt:       row.CreatedAt.Time,
			SurfacedAt:   row.SurfacedAt.Time,
			CreatedAt:    row.CreatedAt.Time,
		}
		if row.ScheduledFor.Valid {
			item.SlotAt = row.ScheduledFor.Time
		}
		if row.State == "ESCALATED" {
			item.Priority = AttentionEscalated
			counts.Escalated++
		} else {
			counts.Unassigned++
		}
		all[index] = item
	}

	filtered, err := filterAttention(all, filter)
	if err != nil {
		return AttentionQueueResult{}, err
	}
	page, nextCursor, err := sliceAttentionPage(filtered, limit, cursor)
	if err != nil {
		return AttentionQueueResult{}, err
	}

	result := AttentionQueueResult{
		Items:       page,
		Counts:      counts,
		HealthyJobs: healthy,
		Total:       counts.All,
		NextCursor:  nextCursor,
		UpdatedAt:   time.Now().UTC(),
	}

	if counts.All == 0 {
		cleared, err := queries.GetLastAttentionClear(ctx)
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			// Nothing was ever cleared — a brand-new install. The all-clear state has no citation.
		case err != nil:
			return AttentionQueueResult{}, fmt.Errorf("reading last queue clear: %w", err)
		default:
			result.LastCleared = &AttentionClear{
				AdminName: cleared.AdminName,
				BookingID: cleared.BookingID,
				At:        cleared.CreatedAt.Time,
			}
		}
	}
	return result, nil
}

func filterAttention(items []AttentionItem, filter AttentionFilter) ([]AttentionItem, error) {
	switch filter {
	case AttentionFilterAll, "":
		return items, nil
	case AttentionFilterEscalated:
		return keepAttention(items, AttentionEscalated), nil
	case AttentionFilterUnassigned:
		return keepAttention(items, AttentionFailedAssignment), nil
	case AttentionFilterSLA, AttentionFilterDelayed:
		// No SLA engine and no delay tracking exist yet; these chips are honestly empty.
		return []AttentionItem{}, nil
	}
	return nil, fmt.Errorf("ops: unknown attention filter %q", filter)
}

func keepAttention(items []AttentionItem, priority AttentionPriority) []AttentionItem {
	kept := make([]AttentionItem, 0, len(items))
	for _, item := range items {
		if item.Priority == priority {
			kept = append(kept, item)
		}
	}
	return kept
}

// attentionSortKey orders an item the way the queue is sorted: tier, then surfaced age, then
// id as the tiebreak. Cursors compare these keys so a page boundary survives queue churn.
type attentionSortKey struct {
	tier       int
	surfacedAt time.Time
	bookingID  uuid.UUID
}

func attentionKeyOf(item AttentionItem) attentionSortKey {
	tier := 1
	if item.Priority == AttentionEscalated {
		tier = 0
	}
	return attentionSortKey{tier: tier, surfacedAt: item.SurfacedAt, bookingID: item.BookingID}
}

func (key attentionSortKey) after(other attentionSortKey) bool {
	if key.tier != other.tier {
		return key.tier > other.tier
	}
	if !key.surfacedAt.Equal(other.surfacedAt) {
		return key.surfacedAt.After(other.surfacedAt)
	}
	return strings.Compare(key.bookingID.String(), other.bookingID.String()) > 0
}

const defaultAttentionLimit = 20
const maxAttentionLimit = 100

func sliceAttentionPage(items []AttentionItem, limit int32, cursor string) ([]AttentionItem, string, error) {
	if limit <= 0 {
		limit = defaultAttentionLimit
	}
	if limit > maxAttentionLimit {
		limit = maxAttentionLimit
	}

	start := 0
	if cursor != "" {
		afterKey, err := decodeAttentionCursor(cursor)
		if err != nil {
			return nil, "", err
		}
		for start < len(items) && !attentionKeyOf(items[start]).after(afterKey) {
			start++
		}
	}

	end := start + int(limit)
	if end > len(items) {
		end = len(items)
	}
	page := items[start:end]

	nextCursor := ""
	if end < len(items) && len(page) > 0 {
		nextCursor = encodeAttentionCursor(attentionKeyOf(page[len(page)-1]))
	}
	return page, nextCursor, nil
}

func encodeAttentionCursor(key attentionSortKey) string {
	raw := fmt.Sprintf("%d|%d|%s", key.tier, key.surfacedAt.UnixNano(), key.bookingID)
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeAttentionCursor(cursor string) (attentionSortKey, error) {
	raw, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return attentionSortKey{}, ErrInvalidCursor
	}
	parts := strings.Split(string(raw), "|")
	if len(parts) != 3 {
		return attentionSortKey{}, ErrInvalidCursor
	}
	tier, err := strconv.Atoi(parts[0])
	if err != nil {
		return attentionSortKey{}, ErrInvalidCursor
	}
	nanos, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return attentionSortKey{}, ErrInvalidCursor
	}
	bookingID, err := uuid.Parse(parts[2])
	if err != nil {
		return attentionSortKey{}, ErrInvalidCursor
	}
	return attentionSortKey{tier: tier, surfacedAt: time.Unix(0, nanos), bookingID: bookingID}, nil
}

// ---------------------------------------------------------------------------
// Activity feed

// ActivityKind is a transition the console's activity vocabulary can name.
type ActivityKind string

const (
	ActivityAssigned            ActivityKind = "ASSIGNED"
	ActivityEnRoute             ActivityKind = "EN_ROUTE"
	ActivityStarted             ActivityKind = "STARTED"
	ActivityAwaitingOTP         ActivityKind = "AWAITING_OTP"
	ActivityCompleted           ActivityKind = "COMPLETED"
	ActivityCancelledByCustomer ActivityKind = "CANCELLED_BY_CUSTOMER"
)

// ActivityEntry is one feed row.
type ActivityEntry struct {
	EventID   uuid.UUID
	BookingID uuid.UUID
	Kind      ActivityKind
	// TechnicianName is set only for ASSIGNED entries, per the console contract.
	TechnicianName *string
	At             time.Time
}

const defaultActivityLimit = 20
const maxActivityLimit = 100

// RecentActivity returns the last N booking transitions the feed can name, newest first. The
// query already excludes transitions outside the feed's vocabulary (and admin cancellations,
// which the cancelled-by-customer kind cannot honestly describe).
func (service *Service) RecentActivity(ctx context.Context, limit int32) ([]ActivityEntry, error) {
	if limit <= 0 {
		limit = defaultActivityLimit
	}
	if limit > maxActivityLimit {
		limit = maxActivityLimit
	}
	rows, err := sqlcgen.New(service.pool).ListRecentBookingActivity(ctx, limit)
	if err != nil {
		return nil, fmt.Errorf("reading activity feed: %w", err)
	}
	entries := make([]ActivityEntry, 0, len(rows))
	for _, row := range rows {
		kind, known := activityKindOf(row.Action)
		if !known {
			continue // defence in depth; the query filter should already exclude these
		}
		entry := ActivityEntry{
			EventID:   row.ID,
			BookingID: row.BookingID,
			Kind:      kind,
			At:        row.CreatedAt.Time,
		}
		if kind == ActivityAssigned {
			entry.TechnicianName = row.TechnicianName
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

func activityKindOf(action string) (ActivityKind, bool) {
	switch action {
	case "ASSIGN":
		return ActivityAssigned, true
	case "DEPART":
		return ActivityEnRoute, true
	case "VERIFY_START":
		return ActivityStarted, true
	case "REQUEST_COMPLETION":
		return ActivityAwaitingOTP, true
	case "VERIFY_COMPLETION":
		return ActivityCompleted, true
	case "CANCEL":
		return ActivityCancelledByCustomer, true
	}
	return "", false
}

// ---------------------------------------------------------------------------
// Dashboard summary

// DashboardPeriod is the window the summary covers.
type DashboardPeriod string

const (
	// PeriodToday is midnight IST to now — the business day.
	PeriodToday DashboardPeriod = "TODAY"
	// PeriodLiveNow is the rolling last hour.
	PeriodLiveNow DashboardPeriod = "LIVE_NOW"
)

// MetricDelta is a whole-unit change against the same window yesterday. IsGood is semantic,
// not directional: a falling assign time is good, a falling booking count is not.
type MetricDelta struct {
	Value  int64
	IsGood bool
}

// RateDelta is the 0–1 fraction sibling of MetricDelta.
type RateDelta struct {
	Value  float64
	IsGood bool
}

// DashboardSummary is the headline KPIs with deltas and 8-point sparklines.
type DashboardSummary struct {
	Bookings        int32
	BookingsDelta   MetricDelta
	Revenue         money.Money
	RevenueDelta    MetricDelta
	CompletionRate  float64
	CompletionDelta RateDelta
	AvgAssignMs     int64
	AvgAssignDelta  MetricDelta

	SparkBookings   []int32
	SparkRevenue    []int64
	SparkCompletion []float64
	SparkAvgAssign  []int64

	UpdatedAt time.Time
}

// SummaryForPeriod computes the dashboard KPIs from real aggregates: bookings created,
// REVENUE ledger entries, terminal outcomes and SEARCHING→ASSIGNED latency, each for the
// requested window and the same window shifted back 24h for the delta.
func (service *Service) SummaryForPeriod(ctx context.Context, period DashboardPeriod) (DashboardSummary, error) {
	now := time.Now()
	var from time.Time
	switch period {
	case PeriodLiveNow:
		from = now.Add(-time.Hour)
	case PeriodToday, "":
		year, month, day := now.In(istZone).Date()
		from = time.Date(year, month, day, 0, 0, 0, 0, istZone)
	default:
		return DashboardSummary{}, fmt.Errorf("ops: unknown dashboard period %q", period)
	}

	today, err := service.windowMetrics(ctx, from, now)
	if err != nil {
		return DashboardSummary{}, err
	}
	yesterday, err := service.windowMetrics(ctx, from.Add(-24*time.Hour), now.Add(-24*time.Hour))
	if err != nil {
		return DashboardSummary{}, err
	}

	summary := DashboardSummary{
		Bookings:        today.bookings,
		BookingsDelta:   goodWhenUp(int64(today.bookings) - int64(yesterday.bookings)),
		Revenue:         money.Money(today.revenuePaise),
		RevenueDelta:    goodWhenUp(today.revenuePaise - yesterday.revenuePaise),
		CompletionRate:  today.completionRate(),
		AvgAssignMs:     today.avgAssignMs(),
		SparkBookings:   today.sparkBookings,
		SparkRevenue:    today.sparkRevenue,
		SparkCompletion: today.sparkCompletion,
		SparkAvgAssign:  today.sparkAvgAssign,
		UpdatedAt:       now.UTC(),
	}
	completionDelta := today.completionRate() - yesterday.completionRate()
	summary.CompletionDelta = RateDelta{Value: completionDelta, IsGood: completionDelta >= 0}
	assignDelta := today.avgAssignMs() - yesterday.avgAssignMs()
	summary.AvgAssignDelta = MetricDelta{Value: assignDelta, IsGood: assignDelta <= 0}
	return summary, nil
}

func goodWhenUp(delta int64) MetricDelta {
	return MetricDelta{Value: delta, IsGood: delta >= 0}
}

// windowMetrics is one window's raw aggregates plus its sparkline buckets.
type windowMetrics struct {
	bookings     int32
	revenuePaise int64
	completed    int32
	terminal     int32
	assignMsSum  int64
	assignPairs  int32

	sparkBookings   []int32
	sparkRevenue    []int64
	sparkCompletion []float64
	sparkAvgAssign  []int64
}

func (metrics windowMetrics) completionRate() float64 {
	if metrics.terminal == 0 {
		return 0
	}
	return float64(metrics.completed) / float64(metrics.terminal)
}

func (metrics windowMetrics) avgAssignMs() int64 {
	if metrics.assignPairs == 0 {
		return 0
	}
	return metrics.assignMsSum / int64(metrics.assignPairs)
}

func (service *Service) windowMetrics(ctx context.Context, from, to time.Time) (windowMetrics, error) {
	queries := sqlcgen.New(service.pool)
	fromTs := pgtype.Timestamptz{Time: from, Valid: true}
	toTs := pgtype.Timestamptz{Time: to, Valid: true}

	metrics := windowMetrics{
		sparkBookings:   make([]int32, sparklinePoints),
		sparkRevenue:    make([]int64, sparklinePoints),
		sparkCompletion: make([]float64, sparklinePoints),
		sparkAvgAssign:  make([]int64, sparklinePoints),
	}

	bookingBuckets, err := queries.DashboardBookingsByBucket(ctx, sqlcgen.DashboardBookingsByBucketParams{FromTime: fromTs, ToTime: toTs})
	if err != nil {
		return windowMetrics{}, fmt.Errorf("bucketing bookings: %w", err)
	}
	for _, bucket := range bookingBuckets {
		if index, ok := bucketIndex(bucket.Bucket); ok {
			metrics.sparkBookings[index] += bucket.Bookings
		}
		metrics.bookings += bucket.Bookings
	}

	revenueBuckets, err := queries.DashboardRevenueByBucket(ctx, sqlcgen.DashboardRevenueByBucketParams{FromTime: fromTs, ToTime: toTs})
	if err != nil {
		return windowMetrics{}, fmt.Errorf("bucketing revenue: %w", err)
	}
	for _, bucket := range revenueBuckets {
		if index, ok := bucketIndex(bucket.Bucket); ok {
			metrics.sparkRevenue[index] += bucket.RevenuePaise
		}
		metrics.revenuePaise += bucket.RevenuePaise
	}

	outcomeBuckets, err := queries.DashboardOutcomesByBucket(ctx, sqlcgen.DashboardOutcomesByBucketParams{FromTime: fromTs, ToTime: toTs})
	if err != nil {
		return windowMetrics{}, fmt.Errorf("bucketing outcomes: %w", err)
	}
	for _, bucket := range outcomeBuckets {
		if index, ok := bucketIndex(bucket.Bucket); ok && bucket.Terminal > 0 {
			metrics.sparkCompletion[index] = float64(bucket.Completed) / float64(bucket.Terminal)
		}
		metrics.completed += bucket.Completed
		metrics.terminal += bucket.Terminal
	}

	assignBuckets, err := queries.DashboardAssignByBucket(ctx, sqlcgen.DashboardAssignByBucketParams{FromTime: fromTs, ToTime: toTs})
	if err != nil {
		return windowMetrics{}, fmt.Errorf("bucketing assign latency: %w", err)
	}
	for _, bucket := range assignBuckets {
		if index, ok := bucketIndex(bucket.Bucket); ok && bucket.Pairs > 0 {
			metrics.sparkAvgAssign[index] = bucket.TotalMs / int64(bucket.Pairs)
		}
		metrics.assignMsSum += bucket.TotalMs
		metrics.assignPairs += bucket.Pairs
	}

	return metrics, nil
}

// bucketIndex maps width_bucket's 1-based bucket to a sparkline index. A row created at the
// exact window end would land in bucket 9; the [from, to) WHERE clause prevents that, but the
// guard keeps a race from panicking.
func bucketIndex(bucket int32) (int, bool) {
	if bucket < 1 || bucket > sparklinePoints {
		return 0, false
	}
	return int(bucket - 1), true
}
