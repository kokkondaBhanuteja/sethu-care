package rescue_test

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/audit"
	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
	"github.com/kokkondaBhanuteja/sethu-care/internal/rescue"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
)

const migrationsDir = "../../db/migrations"

// rescueFixture seeds the shared scaffolding once, then mints bookings through the REAL
// booking service so every transition writes the booking_events and audit rows the rescue
// console reads back.
type rescueFixture struct {
	pool     *pgxpool.Pool
	bookings *booking.Service
	ledgers  *ledger.Service
	trail    *audit.Service
	rescue   *rescue.Service

	adminID    uuid.UUID
	customerID uuid.UUID
	addressID  uuid.UUID
	serviceID  uuid.UUID
	variantID  uuid.UUID
}

func newRescueFixture(t *testing.T) *rescueFixture {
	t.Helper()
	pool := storagetest.NewPool(t, migrationsDir)
	bookingService := booking.NewService(pool)
	ledgerService := ledger.NewService(pool)
	auditService := audit.NewService(pool)
	fixture := &rescueFixture{
		pool:     pool,
		bookings: bookingService,
		ledgers:  ledgerService,
		trail:    auditService,
		rescue:   rescue.New(pool, bookingService, ledgerService, auditService),
	}

	fixture.adminID = uuid.New()
	fixture.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Ops Admin', 'ADMIN')",
		fixture.adminID, "+9199"+fixture.adminID.String()[:8])
	fixture.customerID = uuid.New()
	fixture.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Ravi', 'CUSTOMER')",
		fixture.customerID, "+9190"+fixture.customerID.String()[:8])
	fixture.addressID = uuid.New()
	fixture.exec(t, `INSERT INTO addresses (id, user_id, line1, city, pincode, geog)
		VALUES ($1, $2, '1 Rd', 'Bengaluru', '560001', ST_MakePoint(77.59,12.97)::geography)`,
		fixture.addressID, fixture.customerID)

	categoryID := uuid.New()
	fixture.serviceID = uuid.New()
	fixture.variantID = uuid.New()
	fixture.exec(t, "INSERT INTO categories (id, name, slug) VALUES ($1, 'AC', 'ac')", categoryID)
	fixture.exec(t, "INSERT INTO services (id, category_id, name, slug) VALUES ($1, $2, 'AC Service', 'ac-svc')",
		fixture.serviceID, categoryID)
	fixture.exec(t, "INSERT INTO service_variants (id, service_id, name, base_price_paise) VALUES ($1, $2, 'Standard', 59900)",
		fixture.variantID, fixture.serviceID)
	return fixture
}

func (fixture *rescueFixture) exec(t *testing.T, sql string, args ...any) {
	t.Helper()
	if _, err := fixture.pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("exec: %v\n  %s", err, sql)
	}
}

func (fixture *rescueFixture) createBooking(t *testing.T) uuid.UUID {
	t.Helper()
	created, err := fixture.bookings.Create(context.Background(), booking.CreateInput{
		CustomerID: fixture.customerID, AddressID: fixture.addressID, VariantID: fixture.variantID, Quantity: 1,
	})
	if err != nil {
		t.Fatalf("Create booking: %v", err)
	}
	return created.BookingID
}

func (fixture *rescueFixture) applyAsAdmin(t *testing.T, bookingID uuid.UUID, action booking.Action) {
	t.Helper()
	adminID := fixture.adminID
	if _, err := fixture.bookings.Apply(context.Background(), bookingID, action, booking.TransitionInput{
		Actor: &adminID, ActorRole: identity.RoleAdmin,
	}); err != nil {
		t.Fatalf("%s on %s: %v", action, bookingID, err)
	}
}

// escalatedBooking mints DRAFT → CONFIRMED → SEARCHING → ESCALATED (version 3).
func (fixture *rescueFixture) escalatedBooking(t *testing.T) uuid.UUID {
	t.Helper()
	bookingID := fixture.createBooking(t)
	fixture.applyAsAdmin(t, bookingID, booking.ActionConfirm)
	fixture.applyAsAdmin(t, bookingID, booking.ActionSearch)
	fixture.applyAsAdmin(t, bookingID, booking.ActionEscalate)
	return bookingID
}

func (fixture *rescueFixture) seedTechnician(t *testing.T, name string, hasSkill bool, lat, lng *float64) uuid.UUID {
	t.Helper()
	technicianID := uuid.New()
	fixture.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, $3, 'TECHNICIAN')",
		technicianID, "+9191"+technicianID.String()[:8], name)
	fixture.exec(t, `INSERT INTO technicians (user_id, city, is_online, last_lat, last_lng, last_location_at)
		VALUES ($1, 'Bengaluru', true, $2, $3, CASE WHEN $2::float8 IS NULL THEN NULL ELSE now() END)`,
		technicianID, lat, lng)
	if hasSkill {
		fixture.exec(t, "INSERT INTO technician_skills (technician_id, skill_id) SELECT $1, id FROM skills", technicianID)
	}
	return technicianID
}

func (fixture *rescueFixture) requireSkill(t *testing.T, code, name string) {
	t.Helper()
	skillID := uuid.New()
	fixture.exec(t, "INSERT INTO skills (id, code, name) VALUES ($1, $2, $3)", skillID, code, name)
	fixture.exec(t, "INSERT INTO service_required_skills (service_id, skill_id) VALUES ($1, $2)", fixture.serviceID, skillID)
}

func (fixture *rescueFixture) assign(t *testing.T, bookingID, technicianID uuid.UUID) {
	t.Helper()
	adminID := fixture.adminID
	if _, err := fixture.bookings.Apply(context.Background(), bookingID, booking.ActionAssign, booking.TransitionInput{
		Actor: &adminID, ActorRole: identity.RoleAdmin, AssignTechnician: &technicianID,
	}); err != nil {
		t.Fatalf("assign: %v", err)
	}
}

// backdateEvents rewrites the created_at of a booking's events for one action — the only
// way to test a time window without waiting it out. The append-only trigger is disabled
// for exactly this statement; production has no such path.
func (fixture *rescueFixture) backdateEvents(t *testing.T, bookingID uuid.UUID, action booking.Action, by time.Duration) {
	t.Helper()
	fixture.exec(t, "ALTER TABLE booking_events DISABLE TRIGGER booking_events_are_append_only")
	fixture.exec(t, `UPDATE booking_events SET created_at = created_at - ($3::bigint * interval '1 second')
		WHERE booking_id = $1 AND action = $2`,
		bookingID, string(action), int64(by.Seconds()))
	fixture.exec(t, "ALTER TABLE booking_events ENABLE TRIGGER booking_events_are_append_only")
}

func (fixture *rescueFixture) version(t *testing.T, bookingID uuid.UUID) int32 {
	t.Helper()
	var version int64
	if err := fixture.pool.QueryRow(context.Background(),
		"SELECT version FROM bookings WHERE id = $1", bookingID).Scan(&version); err != nil {
		t.Fatalf("reading version: %v", err)
	}
	return int32(version)
}

func (fixture *rescueFixture) state(t *testing.T, bookingID uuid.UUID) string {
	t.Helper()
	var state string
	if err := fixture.pool.QueryRow(context.Background(),
		"SELECT state FROM bookings WHERE id = $1", bookingID).Scan(&state); err != nil {
		t.Fatalf("reading state: %v", err)
	}
	return state
}

func (fixture *rescueFixture) seedRevenue(t *testing.T, bookingID uuid.UUID, amountPaise int64) {
	t.Helper()
	fixture.exec(t, `INSERT INTO ledger_entries (kind, amount_paise, order_id, customer_id, method, memo)
		SELECT 'REVENUE', $2, order_id, customer_id, 'UPI', 'test revenue' FROM bookings WHERE id = $1`,
		bookingID, amountPaise)
}

func (fixture *rescueFixture) countRows(t *testing.T, sql string, args ...any) int {
	t.Helper()
	var total int
	if err := fixture.pool.QueryRow(context.Background(), sql, args...).Scan(&total); err != nil {
		t.Fatalf("count: %v", err)
	}
	return total
}

func (fixture *rescueFixture) actionInput(t *testing.T, bookingID uuid.UUID, key string) rescue.ActionInput {
	t.Helper()
	return rescue.ActionInput{
		BookingID:      bookingID,
		AdminID:        fixture.adminID,
		IdempotencyKey: key,
		Version:        fixture.version(t, bookingID),
	}
}

// ---------------------------------------------------------------------------

// The candidate list ranks real technicians: skill-match first, then distance; offline
// technicians never appear; a fully loaded technician reads as onJob.
func TestAssignContextRanksRealTechnicians(t *testing.T) {
	fixture := newRescueFixture(t)
	ctx := context.Background()
	fixture.requireSkill(t, "AC_REPAIR", "AC Repair")
	bookingID := fixture.escalatedBooking(t)

	near := func(lat, lng float64) (*float64, *float64) { return &lat, &lng }
	nearLat, nearLng := near(12.975, 77.595) // ~600m from the booking
	farLat, farLng := near(13.10, 77.75)     // ~20km away

	skilledNear := fixture.seedTechnician(t, "Skilled Near", true, nearLat, nearLng)
	skilledFar := fixture.seedTechnician(t, "Skilled Far", true, farLat, farLng)
	skilledNoLocation := fixture.seedTechnician(t, "Skilled Unlocated", true, nil, nil)
	unskilledNear := fixture.seedTechnician(t, "Unskilled Near", false, nearLat, nearLng)
	offline := fixture.seedTechnician(t, "Offline", true, nearLat, nearLng)
	fixture.exec(t, "UPDATE technicians SET is_online = false WHERE user_id = $1", offline)

	// A technician at their concurrency cap still appears — flagged onJob, not hidden.
	otherJob := fixture.escalatedBooking(t)
	fixture.assign(t, otherJob, skilledFar)

	built, err := fixture.rescue.AssignContext(ctx, bookingID)
	if err != nil {
		t.Fatalf("AssignContext: %v", err)
	}

	wantOrder := []uuid.UUID{skilledNear, skilledFar, skilledNoLocation, unskilledNear}
	if len(built.Candidates) != len(wantOrder) {
		t.Fatalf("candidates = %d, want %d (%+v)", len(built.Candidates), len(wantOrder), built.Candidates)
	}
	for index, wantID := range wantOrder {
		if built.Candidates[index].ProviderID != wantID {
			t.Errorf("candidates[%d] = %s (%s), want %s", index,
				built.Candidates[index].ProviderID, built.Candidates[index].Name, wantID)
		}
	}
	best := built.Candidates[0]
	if !best.IsBestMatch || built.Candidates[1].IsBestMatch {
		t.Error("only the top candidate is the best match")
	}
	if best.DistanceKm <= 0 || best.DistanceKm > 2 {
		t.Errorf("near distance = %.2f km, want ~0.6", best.DistanceKm)
	}
	if best.EtaMinutes <= 0 {
		t.Errorf("a located candidate has an ETA, got %d", best.EtaMinutes)
	}
	if best.Skill == nil || *best.Skill != "AC Repair" {
		t.Errorf("matched skill = %v, want AC Repair", best.Skill)
	}
	if best.Availability != rescue.CandidateAvailable {
		t.Errorf("free technician availability = %s", best.Availability)
	}
	if built.Candidates[1].Availability != rescue.CandidateOnJob {
		t.Errorf("loaded technician availability = %s, want onJob", built.Candidates[1].Availability)
	}
	if built.Candidates[2].DistanceKm != 0 || built.Candidates[2].EtaMinutes != 0 {
		t.Errorf("unlocated candidate distance/eta = %.2f/%d, want honest zeros",
			built.Candidates[2].DistanceKm, built.Candidates[2].EtaMinutes)
	}
	if built.Candidates[3].Skill != nil {
		t.Errorf("unskilled candidate skill = %v, want nil", *built.Candidates[3].Skill)
	}

	if built.Subject.State != booking.StateEscalated || built.Subject.EscalatedMinutes == nil {
		t.Errorf("subject = %+v, want an escalated subject with minutes", built.Subject)
	}
	if built.Subject.Zone != "Bengaluru" || built.Subject.Version != 3 {
		t.Errorf("subject zone/version = %s/%d", built.Subject.Zone, built.Subject.Version)
	}
	if len(built.RankingWeights) == 0 {
		t.Error("ranking weights are server-stated, got none")
	}
}

// Cancel: version-guarded, refund recorded through the ledger, idempotent under the key;
// the 10-second undo escalates the booking back and reverses the credit.
func TestCancelUndoCancelAndReplay(t *testing.T) {
	fixture := newRescueFixture(t)
	ctx := context.Background()
	bookingID := fixture.escalatedBooking(t)
	fixture.seedRevenue(t, bookingID, 59900)

	cancelContext, err := fixture.rescue.CancelContext(ctx, bookingID)
	if err != nil {
		t.Fatalf("CancelContext: %v", err)
	}
	if cancelContext.PolicyRefundPaise != 59900 || !cancelContext.IsPolicyRefundFull {
		t.Errorf("policy refund = %d/full=%t, want 59900/true",
			cancelContext.PolicyRefundPaise, cancelContext.IsPolicyRefundFull)
	}
	if cancelContext.CancellationFee != 0 || cancelContext.TechnicianOnSite {
		t.Errorf("fee/on-site = %d/%t, want 0/false", cancelContext.CancellationFee, cancelContext.TechnicianOnSite)
	}

	// A stale version is refused before anything happens.
	staleInput := fixture.actionInput(t, bookingID, "cancel-key")
	staleInput.Version--
	var stale *rescue.StaleVersionError
	if _, err := fixture.rescue.Cancel(ctx, rescue.CancelInput{
		ActionInput: staleInput, ReasonCode: "customer_unreachable", RefundAmount: money.FromPaise(59900),
	}); !errors.As(err, &stale) {
		t.Fatalf("stale cancel = %v, want StaleVersionError", err)
	}

	// An off-policy amount without its justification is refused.
	var invalid *rescue.ValidationError
	if _, err := fixture.rescue.Cancel(ctx, rescue.CancelInput{
		ActionInput: fixture.actionInput(t, bookingID, "cancel-key"),
		ReasonCode:  "customer_unreachable", RefundAmount: money.FromPaise(100),
	}); !errors.As(err, &invalid) {
		t.Fatalf("off-policy cancel = %v, want ValidationError", err)
	}

	receipt, err := fixture.rescue.Cancel(ctx, rescue.CancelInput{
		ActionInput: fixture.actionInput(t, bookingID, "cancel-key"),
		ReasonCode:  "customer_unreachable", Note: "no answer on three calls",
		RefundAmount: money.FromPaise(59900),
	})
	if err != nil {
		t.Fatalf("Cancel: %v", err)
	}
	if fixture.state(t, bookingID) != "CANCELLED" {
		t.Errorf("state = %s, want CANCELLED", fixture.state(t, bookingID))
	}
	if receipt.Version != fixture.version(t, bookingID) {
		t.Errorf("receipt version = %d, want %d", receipt.Version, fixture.version(t, bookingID))
	}
	credits := fixture.countRows(t,
		"SELECT count(*) FROM ledger_entries WHERE kind = 'CREDIT_ISSUED' AND memo LIKE 'admin cancel refund%'")
	if credits != 1 {
		t.Fatalf("cancel credits = %d, want 1", credits)
	}
	if trail := fixture.countRows(t,
		"SELECT count(*) FROM audit_logs WHERE entity_type = 'booking' AND action = 'CANCEL' AND entity_id = $1",
		bookingID); trail != 1 {
		t.Errorf("CANCEL audit rows = %d, want 1", trail)
	}
	if trail := fixture.countRows(t,
		"SELECT count(*) FROM audit_logs WHERE entity_type = 'booking' AND action = 'CANCEL_REFUND' AND entity_id = $1",
		bookingID); trail != 1 {
		t.Errorf("CANCEL_REFUND audit rows = %d, want 1", trail)
	}

	// Replaying the key returns the FIRST receipt and does not act again.
	replayInput := fixture.actionInput(t, bookingID, "cancel-key")
	replayInput.Version = receipt.Version - 1 // even a stale version replays; nothing re-executes
	replayed, err := fixture.rescue.Cancel(ctx, rescue.CancelInput{
		ActionInput: replayInput, ReasonCode: "customer_unreachable", RefundAmount: money.FromPaise(59900),
	})
	if err != nil {
		t.Fatalf("replay: %v", err)
	}
	if replayed != receipt {
		t.Errorf("replayed receipt = %+v, want %+v", replayed, receipt)
	}
	if again := fixture.countRows(t,
		"SELECT count(*) FROM ledger_entries WHERE kind = 'CREDIT_ISSUED' AND memo LIKE 'admin cancel refund%'"); again != 1 {
		t.Errorf("credits after replay = %d, want still 1", again)
	}

	// A NEW key against the now-cancelled booking is a designed conflict.
	var terminal *rescue.TerminalStateError
	if _, err := fixture.rescue.Cancel(ctx, rescue.CancelInput{
		ActionInput: fixture.actionInput(t, bookingID, "cancel-key-2"),
		ReasonCode:  "customer_unreachable", RefundAmount: money.FromPaise(0),
	}); !errors.As(err, &terminal) {
		t.Fatalf("second cancel = %v, want TerminalStateError", err)
	}

	// The undo, inside its window: a real compensating ESCALATE plus the credit reversal.
	undone, err := fixture.rescue.UndoCancel(ctx, fixture.actionInput(t, bookingID, "undo-key"))
	if err != nil {
		t.Fatalf("UndoCancel: %v", err)
	}
	if fixture.state(t, bookingID) != "ESCALATED" {
		t.Errorf("state after undo = %s, want ESCALATED", fixture.state(t, bookingID))
	}
	if !undone.RefundReversed || undone.RefundReversalFailureReason != nil {
		t.Errorf("undo receipt = %+v, want the refund reversed", undone)
	}
	if reversals := fixture.countRows(t,
		"SELECT count(*) FROM ledger_entries WHERE kind = 'CREDIT_REDEEMED' AND reverses_entry_id IS NOT NULL"); reversals != 1 {
		t.Errorf("reversal rows = %d, want 1", reversals)
	}
	replayedUndo, err := fixture.rescue.UndoCancel(ctx, fixture.actionInput(t, bookingID, "undo-key"))
	if err != nil || replayedUndo.Receipt != undone.Receipt {
		t.Errorf("undo replay = %+v (%v), want the first receipt", replayedUndo, err)
	}

	// Cancel again, age the cancellation past 10 seconds: the window has closed.
	if _, err := fixture.rescue.Cancel(ctx, rescue.CancelInput{
		ActionInput: fixture.actionInput(t, bookingID, "cancel-key-3"),
		ReasonCode:  "duplicate_booking", RefundAmount: money.FromPaise(0),
		OverrideJustification: "already refunded on the first cancel",
	}); err != nil {
		t.Fatalf("re-cancel: %v", err)
	}
	fixture.backdateEvents(t, bookingID, booking.ActionCancel, 11*time.Second)
	var windowClosed *rescue.UndoWindowClosedError
	if _, err := fixture.rescue.UndoCancel(ctx, fixture.actionInput(t, bookingID, "undo-key-2")); !errors.As(err, &windowClosed) {
		t.Fatalf("late undo = %v, want UndoWindowClosedError", err)
	}
}

// The assign undo: only an ASSIGNED booking, only inside 30 seconds, back to ESCALATED.
func TestUndoAssignWindow(t *testing.T) {
	fixture := newRescueFixture(t)
	ctx := context.Background()
	bookingID := fixture.escalatedBooking(t)

	var notUndoable *rescue.NotUndoableError
	if _, err := fixture.rescue.UndoAssign(ctx, fixture.actionInput(t, bookingID, "undo-a-0")); !errors.As(err, &notUndoable) {
		t.Fatalf("undo before assign = %v, want NotUndoableError", err)
	}

	technicianID := fixture.seedTechnician(t, "Tessa Tech", false, nil, nil)
	fixture.assign(t, bookingID, technicianID)

	receipt, err := fixture.rescue.UndoAssign(ctx, fixture.actionInput(t, bookingID, "undo-a-1"))
	if err != nil {
		t.Fatalf("UndoAssign: %v", err)
	}
	if fixture.state(t, bookingID) != "ESCALATED" {
		t.Errorf("state after undo = %s, want ESCALATED", fixture.state(t, bookingID))
	}
	if receipt.Version != fixture.version(t, bookingID) {
		t.Errorf("receipt version = %d, want %d", receipt.Version, fixture.version(t, bookingID))
	}
	// The compensation is itself audited (booking.Apply records the ESCALATE).
	if trail := fixture.countRows(t,
		"SELECT count(*) FROM audit_logs WHERE entity_type = 'booking' AND action = 'ESCALATE' AND entity_id = $1",
		bookingID); trail == 0 {
		t.Error("the undo left no audit trail")
	}

	fixture.assign(t, bookingID, technicianID)
	fixture.backdateEvents(t, bookingID, booking.ActionAssign, 31*time.Second)
	var windowClosed *rescue.UndoWindowClosedError
	if _, err := fixture.rescue.UndoAssign(ctx, fixture.actionInput(t, bookingID, "undo-a-2")); !errors.As(err, &windowClosed) {
		t.Fatalf("late undo = %v, want UndoWindowClosedError", err)
	}
}

// Redispatch: cap enforced, the RESUME transition records the round, and the context
// reports it back with the next widening suggested.
func TestRedispatchRoundsAndCap(t *testing.T) {
	fixture := newRescueFixture(t)
	ctx := context.Background()
	bookingID := fixture.escalatedBooking(t)

	first, err := fixture.rescue.RedispatchContext(ctx, bookingID)
	if err != nil {
		t.Fatalf("RedispatchContext: %v", err)
	}
	if len(first.Rounds) != 0 || first.FailedCycles != 1 || first.DefaultRadius != rescue.RadiusPlus50 {
		t.Errorf("first context = rounds %d, cycles %d, radius %s; want 0/1/plus_50",
			len(first.Rounds), first.FailedCycles, first.DefaultRadius)
	}
	if first.IncentiveCap != rescue.IncentiveCapPaise || first.DefaultIncentive != rescue.DefaultIncentivePaise {
		t.Errorf("caps = %d/%d", first.IncentiveCap, first.DefaultIncentive)
	}

	var capExceeded *rescue.CapExceededError
	if _, err := fixture.rescue.Redispatch(ctx, rescue.RedispatchInput{
		ActionInput: fixture.actionInput(t, bookingID, "redispatch-1"),
		RadiusID:    rescue.RadiusPlus50, IncentivePaise: rescue.IncentiveCapPaise + 1,
	}); !errors.As(err, &capExceeded) {
		t.Fatalf("over-cap incentive = %v, want CapExceededError", err)
	}

	receipt, err := fixture.rescue.Redispatch(ctx, rescue.RedispatchInput{
		ActionInput: fixture.actionInput(t, bookingID, "redispatch-1"),
		RadiusID:    rescue.RadiusPlus50, IncentivePaise: 15000, PriorityBoost: true,
	})
	if err != nil {
		t.Fatalf("Redispatch: %v", err)
	}
	if fixture.state(t, bookingID) != "SEARCHING" {
		t.Errorf("state = %s, want SEARCHING", fixture.state(t, bookingID))
	}
	if receipt.Version != fixture.version(t, bookingID) {
		t.Errorf("receipt version = %d", receipt.Version)
	}

	// From SEARCHING a redispatch is not legal — the machine refuses.
	var illegal *booking.IllegalTransitionError
	if _, err := fixture.rescue.Redispatch(ctx, rescue.RedispatchInput{
		ActionInput: fixture.actionInput(t, bookingID, "redispatch-2"),
		RadiusID:    rescue.RadiusPlus100,
	}); !errors.As(err, &illegal) {
		t.Fatalf("redispatch while searching = %v, want IllegalTransitionError", err)
	}

	fixture.applyAsAdmin(t, bookingID, booking.ActionEscalate)
	second, err := fixture.rescue.RedispatchContext(ctx, bookingID)
	if err != nil {
		t.Fatalf("second RedispatchContext: %v", err)
	}
	if len(second.Rounds) != 1 || second.Rounds[0].Round != 1 || second.Rounds[0].RadiusKm != rescue.RadiusPlus50.KmOf() {
		t.Errorf("rounds = %+v, want the recorded plus_50 round", second.Rounds)
	}
	if second.FailedCycles != 2 || second.DefaultRadius != rescue.RadiusPlus100 {
		t.Errorf("cycles/default = %d/%s, want 2/plus_100", second.FailedCycles, second.DefaultRadius)
	}
}

// Manual completion: the 30-minute lock, the evidence gates, then the EXISTING completion
// path — a VERIFY_COMPLETION carrying the admin-verified marker and the completion event.
func TestManualCompletionLockGatesAndPath(t *testing.T) {
	fixture := newRescueFixture(t)
	ctx := context.Background()

	bookingID := fixture.createBooking(t)
	fixture.applyAsAdmin(t, bookingID, booking.ActionConfirm)
	fixture.applyAsAdmin(t, bookingID, booking.ActionSearch)
	technicianID := fixture.seedTechnician(t, "Tessa Tech", false, nil, nil)
	fixture.assign(t, bookingID, technicianID)
	fixture.applyAsAdmin(t, bookingID, booking.ActionDepart)
	fixture.applyAsAdmin(t, bookingID, booking.ActionArrive)
	fixture.applyAsAdmin(t, bookingID, booking.ActionVerifyStart)
	fixture.applyAsAdmin(t, bookingID, booking.ActionRequestCompletion)

	built, err := fixture.rescue.ManualCompletionContext(ctx, bookingID, fixture.adminID)
	if err != nil {
		t.Fatalf("ManualCompletionContext: %v", err)
	}
	if built.AvailableInMinutes == nil || *built.AvailableInMinutes <= 0 || *built.AvailableInMinutes > 30 {
		t.Errorf("availableInMinutes = %v, want the live lock remainder", built.AvailableInMinutes)
	}
	if built.OtpArrivedAt != nil || built.ProviderName != "Tessa Tech" {
		t.Errorf("context = otp %v, provider %q", built.OtpArrivedAt, built.ProviderName)
	}
	if len(built.Evidence.CallAttempts) != 0 {
		t.Errorf("call attempts = %d, want the honest empty list", len(built.Evidence.CallAttempts))
	}

	completeInput := func(key string) rescue.ManualCompleteInput {
		return rescue.ManualCompleteInput{
			ActionInput: fixture.actionInput(t, bookingID, key),
			ReasonCode:  "customer_phone_unreachable",
			Note:        "customer unreachable after three calls; provider confirmed on site",
			Attestations: rescue.ManualCompletionAttestations{
				AttemptedCustomer: true, BelievesWorkDone: true, SpokeToProvider: true,
			},
			Evidence: rescue.ManualCompletionEvidenceRefs{CallAttemptIDs: []string{"call-1", "call-2"}},
		}
	}

	// Inside the 30-minute lock the server refuses, naming when it lifts.
	var tooEarly *rescue.TooEarlyError
	if _, err := fixture.rescue.ManualComplete(ctx, completeInput("mc-1")); !errors.As(err, &tooEarly) {
		t.Fatalf("early manual complete = %v, want TooEarlyError", err)
	}
	if time.Until(tooEarly.AvailableAt) <= 0 || time.Until(tooEarly.AvailableAt) > 30*time.Minute {
		t.Errorf("availableAt = %v, want within the next 30 minutes", tooEarly.AvailableAt)
	}

	fixture.backdateEvents(t, bookingID, booking.ActionRequestCompletion, 31*time.Minute)

	// No call attempt: the evidence gate names what is owed.
	noCalls := completeInput("mc-2")
	noCalls.Evidence.CallAttemptIDs = nil
	var evidence *rescue.EvidenceError
	if _, err := fixture.rescue.ManualComplete(ctx, noCalls); !errors.As(err, &evidence) {
		t.Fatalf("no-evidence complete = %v, want EvidenceError", err)
	}
	if len(evidence.Missing) == 0 || evidence.Missing[0] != "callAttempts" {
		t.Errorf("missing = %v, want callAttempts named", evidence.Missing)
	}

	shortNote := completeInput("mc-3")
	shortNote.Note = "too short"
	var invalid *rescue.ValidationError
	if _, err := fixture.rescue.ManualComplete(ctx, shortNote); !errors.As(err, &invalid) {
		t.Fatalf("short note = %v, want ValidationError", err)
	}

	receipt, err := fixture.rescue.ManualComplete(ctx, completeInput("mc-4"))
	if err != nil {
		t.Fatalf("ManualComplete: %v", err)
	}
	if fixture.state(t, bookingID) != "COMPLETED" {
		t.Errorf("state = %s, want COMPLETED", fixture.state(t, bookingID))
	}
	// The transition carries the admin-verified marker …
	if marked := fixture.countRows(t,
		`SELECT count(*) FROM booking_events
		  WHERE booking_id = $1 AND action = 'VERIFY_COMPLETION'
		    AND (meta -> 'manual_completion' ->> 'admin_verified')::bool`, bookingID); marked != 1 {
		t.Errorf("admin-verified events = %d, want 1", marked)
	}
	// … and the EXISTING completion path fired: the booking.completed event is queued for
	// the billing consumer, exactly as a customer-OTP completion queues it.
	if queued := fixture.countRows(t,
		"SELECT count(*) FROM outbox WHERE aggregate_id = $1 AND event_type = 'booking.completed'",
		bookingID); queued != 1 {
		t.Errorf("booking.completed outbox rows = %d, want 1", queued)
	}
	// The audit trail names the admin.
	if trail := fixture.countRows(t,
		`SELECT count(*) FROM audit_logs WHERE entity_type = 'booking' AND action = 'VERIFY_COMPLETION'
		   AND entity_id = $1 AND actor_user_id = $2`, bookingID, fixture.adminID); trail != 1 {
		t.Errorf("VERIFY_COMPLETION audit rows = %d, want 1", trail)
	}

	replayed, err := fixture.rescue.ManualComplete(ctx, completeInput("mc-4"))
	if err != nil || replayed != receipt {
		t.Errorf("replay = %+v (%v), want the first receipt", replayed, err)
	}

	// The context now reports no mid-flow OTP: the completion was admin-asserted.
	after, err := fixture.rescue.ManualCompletionContext(ctx, bookingID, fixture.adminID)
	if err != nil {
		t.Fatalf("context after completion: %v", err)
	}
	if after.OtpArrivedAt != nil {
		t.Errorf("otpArrivedAt = %v after an ADMIN completion, want nil", after.OtpArrivedAt)
	}
	if after.AdminCompletionsThisWeek != 1 || after.ProviderCompletionsInSevenDays != 1 {
		t.Errorf("frequency counters = %d/%d, want 1/1",
			after.AdminCompletionsThisWeek, after.ProviderCompletionsInSevenDays)
	}
}

// Refund: the goodwill cap, the refundable bound, the hourly rate limit, and a replay that
// can never move money twice — the replay record commits with the credit.
func TestRefundCapsRateLimitAndReplay(t *testing.T) {
	fixture := newRescueFixture(t)
	ctx := context.Background()
	bookingID := fixture.escalatedBooking(t)
	fixture.seedRevenue(t, bookingID, 59900)

	before, err := fixture.rescue.RefundContext(ctx, bookingID, fixture.adminID)
	if err != nil {
		t.Fatalf("RefundContext: %v", err)
	}
	if before.RefundablePaise != 59900 || before.AlreadyRefundedPaise != 0 {
		t.Errorf("refundable/already = %d/%d, want 59900/0", before.RefundablePaise, before.AlreadyRefundedPaise)
	}
	if before.GoodwillCapPaise != rescue.GoodwillCapPaise || before.RefundsUsedThisHour != 0 ||
		before.RefundsAllowedPerHour != rescue.RefundsAllowedPerHour || before.RateLimitResetsAt != nil {
		t.Errorf("limit state = %+v", before)
	}
	if before.ProviderPayoutPaise != 0 {
		t.Errorf("providerPayoutPaise = %d, want the honest 0 (salaried)", before.ProviderPayoutPaise)
	}
	if before.PaidAt.IsZero() || before.OriginalMethod != "UPI" {
		t.Errorf("paidAt/method = %v/%q", before.PaidAt, before.OriginalMethod)
	}

	refundInput := func(key string, amountPaise int64, refundType string) rescue.RefundInput {
		return rescue.RefundInput{
			ActionInput:  fixture.actionInput(t, bookingID, key),
			Amount:       money.FromPaise(amountPaise),
			ReasonCode:   "poor_service_quality",
			RefundType:   refundType,
			PayoutImpact: "withhold",
			Note:         "visible damage on the panel",
		}
	}

	var capExceeded *rescue.CapExceededError
	if _, err := fixture.rescue.Refund(ctx, refundInput("r-cap", rescue.GoodwillCapPaise+1, "goodwill_credit")); !errors.As(err, &capExceeded) {
		t.Fatalf("goodwill over cap = %v, want CapExceededError", err)
	}
	if capExceeded.Field != "amountPaise" || capExceeded.Cap.Paise() != rescue.GoodwillCapPaise {
		t.Errorf("cap error = %+v", capExceeded)
	}
	var invalid *rescue.ValidationError
	if _, err := fixture.rescue.Refund(ctx, refundInput("r-over", 60000, "partial")); !errors.As(err, &invalid) {
		t.Fatalf("over-refundable = %v, want ValidationError", err)
	}

	receipt, err := fixture.rescue.Refund(ctx, refundInput("r-1", 10000, "partial"))
	if err != nil {
		t.Fatalf("Refund: %v", err)
	}
	if receipt.IsPending {
		t.Error("a ledger credit lands immediately; isPending must be false")
	}
	if ledgerRows := fixture.countRows(t,
		"SELECT count(*) FROM ledger_entries WHERE id = $1 AND kind = 'CREDIT_ISSUED'", receipt.RefundID); ledgerRows != 1 {
		t.Errorf("the receipt's refundId names %d ledger rows, want exactly 1", ledgerRows)
	}

	replayed, err := fixture.rescue.Refund(ctx, refundInput("r-1", 10000, "partial"))
	if err != nil {
		t.Fatalf("refund replay: %v", err)
	}
	if replayed.RefundID != receipt.RefundID {
		t.Errorf("replayed refundId = %s, want %s", replayed.RefundID, receipt.RefundID)
	}
	if credits := fixture.countRows(t,
		"SELECT count(*) FROM ledger_entries WHERE kind = 'CREDIT_ISSUED'"); credits != 1 {
		t.Errorf("credits after replay = %d, want still 1 — a replay must never move money", credits)
	}

	after, err := fixture.rescue.RefundContext(ctx, bookingID, fixture.adminID)
	if err != nil {
		t.Fatalf("RefundContext after: %v", err)
	}
	if after.AlreadyRefundedPaise != 10000 || after.RefundablePaise != 49900 {
		t.Errorf("already/refundable = %d/%d, want 10000/49900", after.AlreadyRefundedPaise, after.RefundablePaise)
	}
	if after.RefundsUsedThisHour != 1 || after.RateLimitResetsAt == nil {
		t.Errorf("used/resetsAt = %d/%v, want 1 and a reset instant", after.RefundsUsedThisHour, after.RateLimitResetsAt)
	}

	// Spend the rest of the hourly budget, then the limit bites with its reset instant.
	for spend := int32(1); spend < rescue.RefundsAllowedPerHour; spend++ {
		if _, err := fixture.rescue.Refund(ctx,
			refundInput(fmt.Sprintf("r-batch-%d", spend), 100, "partial")); err != nil {
			t.Fatalf("budget refund %d: %v", spend, err)
		}
	}
	var limited *rescue.RateLimitedError
	if _, err := fixture.rescue.Refund(ctx, refundInput("r-limit", 100, "partial")); !errors.As(err, &limited) {
		t.Fatalf("over-budget refund = %v, want RateLimitedError", err)
	}
	if time.Until(limited.ResetAt) <= 0 || time.Until(limited.ResetAt) > time.Hour {
		t.Errorf("resetAt = %v, want inside the coming hour", limited.ResetAt)
	}

	if _, err := fixture.rescue.Refund(ctx, rescue.RefundInput{
		ActionInput: rescue.ActionInput{BookingID: uuid.New(), AdminID: fixture.adminID, IdempotencyKey: "r-404", Version: 0},
		Amount:      money.FromPaise(100), ReasonCode: "other", RefundType: "partial", PayoutImpact: "withhold",
	}); !errors.Is(err, booking.ErrBookingNotFound) {
		t.Errorf("unknown booking refund = %v, want ErrBookingNotFound", err)
	}
}
