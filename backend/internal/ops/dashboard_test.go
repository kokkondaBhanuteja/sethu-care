package ops_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ops"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
)

// dashboardFixture seeds the shared scaffolding (an admin, a customer, an address, one
// catalog entry) once, then mints bookings through the REAL booking service so every
// transition writes the booking_events rows the dashboard reads.
type dashboardFixture struct {
	pool     *pgxpool.Pool
	bookings *booking.Service
	ops      *ops.Service
	ledger   *ledger.Service

	adminID    uuid.UUID
	customerID uuid.UUID
	addressID  uuid.UUID
	variantID  uuid.UUID
}

func newDashboardFixture(t *testing.T) *dashboardFixture {
	t.Helper()
	pool := storagetest.NewPool(t, migrationsDir)
	bookingService := booking.NewService(pool)
	fixture := &dashboardFixture{
		pool:     pool,
		bookings: bookingService,
		ops:      ops.New(pool, bookingService),
		ledger:   ledger.NewService(pool),
	}

	fixture.adminID = uuid.New()
	exec(t, pool, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Ops Admin', 'ADMIN')",
		fixture.adminID, "+9199"+fixture.adminID.String()[:8])
	fixture.customerID = uuid.New()
	exec(t, pool, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Ravi', 'CUSTOMER')",
		fixture.customerID, "+9190"+fixture.customerID.String()[:8])
	fixture.addressID = uuid.New()
	exec(t, pool, `INSERT INTO addresses (id, user_id, line1, city, pincode, geog)
		VALUES ($1, $2, '1 Rd', 'Bengaluru', '560001', ST_MakePoint(77.59,12.97)::geography)`,
		fixture.addressID, fixture.customerID)

	categoryID, serviceID := uuid.New(), uuid.New()
	fixture.variantID = uuid.New()
	exec(t, pool, "INSERT INTO categories (id, name, slug) VALUES ($1, 'AC', 'ac')", categoryID)
	exec(t, pool, "INSERT INTO services (id, category_id, name, slug) VALUES ($1, $2, 'AC Service', 'ac-svc')", serviceID, categoryID)
	exec(t, pool, "INSERT INTO service_variants (id, service_id, name, base_price_paise) VALUES ($1, $2, 'Standard', 59900)",
		fixture.variantID, serviceID)
	return fixture
}

// createSearchingBooking mints a booking and drives it DRAFT -> CONFIRMED -> SEARCHING.
func (fixture *dashboardFixture) createSearchingBooking(t *testing.T) uuid.UUID {
	t.Helper()
	created, err := fixture.bookings.Create(context.Background(), booking.CreateInput{
		CustomerID: fixture.customerID, AddressID: fixture.addressID, VariantID: fixture.variantID, Quantity: 1,
	})
	if err != nil {
		t.Fatalf("Create booking: %v", err)
	}
	fixture.applyAs(t, created.BookingID, booking.ActionConfirm, fixture.customerID, identity.RoleCustomer)
	fixture.applyAs(t, created.BookingID, booking.ActionSearch, fixture.adminID, identity.RoleAdmin)
	return created.BookingID
}

func (fixture *dashboardFixture) applyAs(t *testing.T, bookingID uuid.UUID, action booking.Action, actorID uuid.UUID, role identity.Role) {
	t.Helper()
	if _, err := fixture.bookings.Apply(context.Background(), bookingID, action, booking.TransitionInput{
		Actor: &actorID, ActorRole: role,
	}); err != nil {
		t.Fatalf("%s on %s: %v", action, bookingID, err)
	}
}

func (fixture *dashboardFixture) applyAsAdmin(t *testing.T, bookingID uuid.UUID, action booking.Action) {
	t.Helper()
	fixture.applyAs(t, bookingID, action, fixture.adminID, identity.RoleAdmin)
}

func (fixture *dashboardFixture) seedTechnician(t *testing.T, name string) uuid.UUID {
	t.Helper()
	technicianID := uuid.New()
	exec(t, fixture.pool, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, $3, 'TECHNICIAN')",
		technicianID, "+9191"+technicianID.String()[:8], name)
	exec(t, fixture.pool, "INSERT INTO technicians (user_id, city, is_online) VALUES ($1, 'Bengaluru', true)", technicianID)
	return technicianID
}

func (fixture *dashboardFixture) assign(t *testing.T, bookingID, technicianID uuid.UUID) {
	t.Helper()
	if _, err := fixture.ops.Assign(context.Background(), bookingID, technicianID, fixture.adminID); err != nil {
		t.Fatalf("Assign: %v", err)
	}
}

// The queue is served in the server-owned priority order (ESCALATED tier first, then oldest
// surfaced), the chip counts cover every filter regardless of the one applied, and the
// cursor walks the same order page by page.
func TestAttentionQueueOrderFiltersAndPaging(t *testing.T) {
	fixture := newDashboardFixture(t)
	ctx := context.Background()

	oldestSearching := fixture.createSearchingBooking(t)
	escalated := fixture.createSearchingBooking(t)
	fixture.applyAsAdmin(t, escalated, booking.ActionEscalate)
	newerSearching := fixture.createSearchingBooking(t)

	healthy := fixture.createSearchingBooking(t)
	technicianID := fixture.seedTechnician(t, "Tessa Tech")
	fixture.assign(t, healthy, technicianID)

	result, err := fixture.ops.AttentionQueue(ctx, ops.AttentionFilterAll, 0, "")
	if err != nil {
		t.Fatalf("AttentionQueue: %v", err)
	}
	wantOrder := []uuid.UUID{escalated, oldestSearching, newerSearching}
	if len(result.Items) != len(wantOrder) {
		t.Fatalf("queue has %d items, want %d", len(result.Items), len(wantOrder))
	}
	for index, wantID := range wantOrder {
		if result.Items[index].BookingID != wantID {
			t.Errorf("queue[%d] = %s, want %s", index, result.Items[index].BookingID, wantID)
		}
	}
	if result.Items[0].Priority != ops.AttentionEscalated {
		t.Errorf("escalated booking priority = %s", result.Items[0].Priority)
	}
	if result.Items[1].Priority != ops.AttentionFailedAssignment {
		t.Errorf("searching booking priority = %s", result.Items[1].Priority)
	}
	if !result.Items[0].SurfacedAt.After(result.Items[1].SurfacedAt) {
		t.Errorf("escalation surfaced at %v, want after the older search %v",
			result.Items[0].SurfacedAt, result.Items[1].SurfacedAt)
	}
	if result.Counts.All != 3 || result.Counts.Escalated != 1 || result.Counts.Unassigned != 2 {
		t.Errorf("counts = %+v, want all=3 escalated=1 unassigned=2", result.Counts)
	}
	if result.Counts.SLA != 0 || result.Counts.Delayed != 0 {
		t.Errorf("SLA/delayed counts must be honest zeros, got %+v", result.Counts)
	}
	if result.HealthyJobs != 1 {
		t.Errorf("healthyJobs = %d, want 1 (the assigned booking)", result.HealthyJobs)
	}
	if result.Total != 3 {
		t.Errorf("total = %d, want 3", result.Total)
	}
	if result.LastCleared != nil {
		t.Errorf("lastCleared populated while the queue is non-empty")
	}

	escalatedOnly, err := fixture.ops.AttentionQueue(ctx, ops.AttentionFilterEscalated, 0, "")
	if err != nil {
		t.Fatalf("filter escalated: %v", err)
	}
	if len(escalatedOnly.Items) != 1 || escalatedOnly.Items[0].BookingID != escalated {
		t.Errorf("escalated filter = %v", escalatedOnly.Items)
	}
	if escalatedOnly.Total != 3 {
		t.Errorf("filtered total = %d, want the unfiltered 3", escalatedOnly.Total)
	}
	slaOnly, err := fixture.ops.AttentionQueue(ctx, ops.AttentionFilterSLA, 0, "")
	if err != nil {
		t.Fatalf("filter sla: %v", err)
	}
	if len(slaOnly.Items) != 0 {
		t.Errorf("sla filter must be empty until an SLA engine exists, got %v", slaOnly.Items)
	}

	// Page through with limit 1: three pages in queue order, then no next cursor.
	var walked []uuid.UUID
	cursor := ""
	for range 3 {
		page, err := fixture.ops.AttentionQueue(ctx, ops.AttentionFilterAll, 1, cursor)
		if err != nil {
			t.Fatalf("paged AttentionQueue: %v", err)
		}
		if len(page.Items) != 1 {
			t.Fatalf("page has %d items, want 1", len(page.Items))
		}
		walked = append(walked, page.Items[0].BookingID)
		cursor = page.NextCursor
	}
	if cursor != "" {
		t.Errorf("cursor after the last page = %q, want empty", cursor)
	}
	for index, wantID := range wantOrder {
		if walked[index] != wantID {
			t.Errorf("paged walk[%d] = %s, want %s", index, walked[index], wantID)
		}
	}

	if _, err := fixture.ops.AttentionQueue(ctx, ops.AttentionFilterAll, 1, "not-a-cursor"); !errors.Is(err, ops.ErrInvalidCursor) {
		t.Errorf("junk cursor error = %v, want ErrInvalidCursor", err)
	}
}

// An empty queue cites the last human resolution — the most recent admin assignment.
func TestAttentionQueueAllClearCitesLastResolution(t *testing.T) {
	fixture := newDashboardFixture(t)
	ctx := context.Background()

	bookingID := fixture.createSearchingBooking(t)
	technicianID := fixture.seedTechnician(t, "Tessa Tech")
	fixture.assign(t, bookingID, technicianID)

	result, err := fixture.ops.AttentionQueue(ctx, ops.AttentionFilterAll, 0, "")
	if err != nil {
		t.Fatalf("AttentionQueue: %v", err)
	}
	if result.Total != 0 || len(result.Items) != 0 {
		t.Fatalf("queue should be clear, got total=%d items=%d", result.Total, len(result.Items))
	}
	if result.LastCleared == nil {
		t.Fatal("lastCleared missing on an empty queue with a past resolution")
	}
	if result.LastCleared.BookingID != bookingID || result.LastCleared.AdminName != "Ops Admin" {
		t.Errorf("lastCleared = %+v, want the admin assignment of %s", result.LastCleared, bookingID)
	}
}

// The feed carries only transitions its vocabulary can name, newest first; a provider name
// rides only on ASSIGNED; an ADMIN cancellation is excluded because the feed's only
// cancellation kind is cancelled-by-customer.
func TestRecentActivityVocabularyAndOrder(t *testing.T) {
	fixture := newDashboardFixture(t)
	ctx := context.Background()

	technicianID := fixture.seedTechnician(t, "Tessa Tech")
	completed := fixture.createSearchingBooking(t)
	fixture.assign(t, completed, technicianID)
	fixture.applyAsAdmin(t, completed, booking.ActionDepart)
	fixture.applyAsAdmin(t, completed, booking.ActionArrive)
	fixture.applyAsAdmin(t, completed, booking.ActionVerifyStart)
	fixture.applyAsAdmin(t, completed, booking.ActionRequestCompletion)
	fixture.applyAsAdmin(t, completed, booking.ActionVerifyCompletion)

	customerCancelled := fixture.createSearchingBooking(t)
	fixture.applyAs(t, customerCancelled, booking.ActionCancel, fixture.customerID, identity.RoleCustomer)

	adminCancelled := fixture.createSearchingBooking(t)
	fixture.applyAsAdmin(t, adminCancelled, booking.ActionCancel)

	entries, err := fixture.ops.RecentActivity(ctx, 0)
	if err != nil {
		t.Fatalf("RecentActivity: %v", err)
	}

	kindCounts := map[ops.ActivityKind]int{}
	for index, entry := range entries {
		kindCounts[entry.Kind]++
		if index > 0 && entry.At.After(entries[index-1].At) {
			t.Errorf("feed not newest-first at index %d", index)
		}
		if entry.BookingID == adminCancelled {
			t.Errorf("admin cancellation leaked into the feed as %s", entry.Kind)
		}
		if entry.Kind == ops.ActivityAssigned {
			if entry.TechnicianName == nil || *entry.TechnicianName != "Tessa Tech" {
				t.Errorf("assigned entry technician = %v, want Tessa Tech", entry.TechnicianName)
			}
		} else if entry.TechnicianName != nil {
			t.Errorf("%s entry carries a technician name; only assigned may", entry.Kind)
		}
	}
	want := map[ops.ActivityKind]int{
		ops.ActivityAssigned:            1,
		ops.ActivityEnRoute:             1,
		ops.ActivityStarted:             1,
		ops.ActivityAwaitingOTP:         1,
		ops.ActivityCompleted:           1,
		ops.ActivityCancelledByCustomer: 1,
	}
	for kind, count := range want {
		if kindCounts[kind] != count {
			t.Errorf("feed has %d %s entries, want %d", kindCounts[kind], kind, count)
		}
	}
	if len(entries) != 6 {
		t.Errorf("feed has %d entries, want exactly the 6 nameable transitions", len(entries))
	}

	limited, err := fixture.ops.RecentActivity(ctx, 2)
	if err != nil {
		t.Fatalf("limited RecentActivity: %v", err)
	}
	if len(limited) != 2 {
		t.Errorf("limit 2 returned %d entries", len(limited))
	}
}

// The summary's KPIs come from real rows: bookings created, captured REVENUE, terminal
// outcomes and the SEARCHING -> ASSIGNED latency — with yesterday empty, every delta equals
// today's value and carries the metric's own good/bad sense.
func TestSummaryForPeriodComputesTodayAggregates(t *testing.T) {
	fixture := newDashboardFixture(t)
	ctx := context.Background()

	technicianID := fixture.seedTechnician(t, "Tessa Tech")
	completed := fixture.createSearchingBooking(t)
	fixture.assign(t, completed, technicianID)
	fixture.applyAsAdmin(t, completed, booking.ActionDepart)
	fixture.applyAsAdmin(t, completed, booking.ActionArrive)
	fixture.applyAsAdmin(t, completed, booking.ActionVerifyStart)
	fixture.applyAsAdmin(t, completed, booking.ActionRequestCompletion)
	fixture.applyAsAdmin(t, completed, booking.ActionVerifyCompletion)

	// Bill and capture the completed job so a REVENUE row exists.
	if err := fixture.ledger.RecordCompletion(ctx, completed, ledger.PaymentUPI); err != nil {
		t.Fatalf("RecordCompletion: %v", err)
	}
	collection, err := fixture.ledger.CollectionForBooking(ctx, completed)
	if err != nil {
		t.Fatalf("CollectionForBooking: %v", err)
	}
	if err := fixture.ledger.CaptureUPIPayment(ctx, collection.Reference, nil); err != nil {
		t.Fatalf("CaptureUPIPayment: %v", err)
	}

	cancelled := fixture.createSearchingBooking(t)
	fixture.applyAs(t, cancelled, booking.ActionCancel, fixture.customerID, identity.RoleCustomer)

	summary, err := fixture.ops.SummaryForPeriod(ctx, ops.PeriodToday)
	if err != nil {
		t.Fatalf("SummaryForPeriod: %v", err)
	}

	if summary.Bookings != 2 {
		t.Errorf("bookings today = %d, want 2", summary.Bookings)
	}
	if summary.BookingsDelta.Value != 2 || !summary.BookingsDelta.IsGood {
		t.Errorf("bookings delta = %+v, want +2 and good", summary.BookingsDelta)
	}
	if summary.Revenue.Paise() != 59900 {
		t.Errorf("revenue = %d paise, want 59900", summary.Revenue.Paise())
	}
	if summary.RevenueDelta.Value != 59900 || !summary.RevenueDelta.IsGood {
		t.Errorf("revenue delta = %+v, want +59900 and good", summary.RevenueDelta)
	}
	if summary.CompletionRate != 0.5 {
		t.Errorf("completion rate = %v, want 0.5 (1 completed of 2 terminal)", summary.CompletionRate)
	}
	if summary.AvgAssignMs <= 0 {
		t.Errorf("avg assign ms = %d, want > 0", summary.AvgAssignMs)
	}
	// The assign time "rose" from an empty yesterday — a rising assign time is NOT good news.
	if summary.AvgAssignDelta.Value != summary.AvgAssignMs || summary.AvgAssignDelta.IsGood {
		t.Errorf("assign delta = %+v, want value=%d and not good", summary.AvgAssignDelta, summary.AvgAssignMs)
	}

	assertSparkline := func(name string, gotLen int, total, want int64) {
		if gotLen != 8 {
			t.Errorf("%s sparkline has %d points, want 8", name, gotLen)
		}
		if total != want {
			t.Errorf("%s sparkline sums to %d, want %d", name, total, want)
		}
	}
	var bookingsSum, revenueSum int64
	for _, point := range summary.SparkBookings {
		bookingsSum += int64(point)
	}
	for _, point := range summary.SparkRevenue {
		revenueSum += point
	}
	assertSparkline("bookings", len(summary.SparkBookings), bookingsSum, 2)
	assertSparkline("revenue", len(summary.SparkRevenue), revenueSum, 59900)
	if len(summary.SparkCompletion) != 8 || len(summary.SparkAvgAssign) != 8 {
		t.Errorf("completion/avgAssign sparklines not 8 points: %d, %d",
			len(summary.SparkCompletion), len(summary.SparkAvgAssign))
	}

	// The rolling last hour sees the same young rows.
	liveNow, err := fixture.ops.SummaryForPeriod(ctx, ops.PeriodLiveNow)
	if err != nil {
		t.Fatalf("SummaryForPeriod live_now: %v", err)
	}
	if liveNow.Bookings != 2 || liveNow.Revenue.Paise() != 59900 {
		t.Errorf("live_now = %d bookings / %d paise, want 2 / 59900", liveNow.Bookings, liveNow.Revenue.Paise())
	}
}
