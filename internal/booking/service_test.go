package booking_test

import (
	"context"
	"errors"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
)

const migrationsDir = "../../db/migrations"

// A legal transition must: change the state, bump the version, append exactly one
// booking_events row, and — because CONFIRM is a §8 event — write exactly one outbox row.
// All of it, or none of it.
func TestApplyPersistsTransitionEventAndOutboxTogether(t *testing.T) {
	pool := storagetest.NewPool(t, migrationsDir)
	svc := booking.NewService(pool)
	ctx := context.Background()

	bookingID := seedBooking(t, pool)

	newState, err := svc.Apply(ctx, bookingID, booking.ActionConfirm, booking.TransitionInput{})
	if err != nil {
		t.Fatalf("Apply(CONFIRM) failed: %v", err)
	}
	if newState != booking.StateConfirmed {
		t.Fatalf("new state = %s, want CONFIRMED", newState)
	}

	// The booking row moved and its version bumped.
	var state string
	var version int64
	if err := pool.QueryRow(ctx, "SELECT state, version FROM bookings WHERE id=$1", bookingID).
		Scan(&state, &version); err != nil {
		t.Fatalf("reading booking back: %v", err)
	}
	if state != "CONFIRMED" || version != 1 {
		t.Errorf("booking row = (%s, v%d), want (CONFIRMED, v1)", state, version)
	}

	// Exactly one event, recording the exact transition.
	var evFrom, evAction, evTo string
	var eventCount int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM booking_events WHERE booking_id=$1", bookingID).
		Scan(&eventCount); err != nil {
		t.Fatal(err)
	}
	if eventCount != 1 {
		t.Fatalf("booking_events rows = %d, want 1", eventCount)
	}
	if err := pool.QueryRow(ctx,
		"SELECT from_state, action, to_state FROM booking_events WHERE booking_id=$1", bookingID).
		Scan(&evFrom, &evAction, &evTo); err != nil {
		t.Fatal(err)
	}
	if evFrom != "DRAFT" || evAction != "CONFIRM" || evTo != "CONFIRMED" {
		t.Errorf("event = (%s, %s, %s), want (DRAFT, CONFIRM, CONFIRMED)", evFrom, evAction, evTo)
	}

	// Exactly one outbox row, unpublished, with the §8 event name.
	var eventType string
	var published *string
	if err := pool.QueryRow(ctx,
		"SELECT event_type, published_at FROM outbox WHERE aggregate_id=$1", bookingID).
		Scan(&eventType, &published); err != nil {
		t.Fatalf("reading outbox (want exactly one row): %v", err)
	}
	if eventType != "booking.confirmed" {
		t.Errorf("outbox event_type = %q, want booking.confirmed", eventType)
	}
	if published != nil {
		t.Errorf("outbox row should be unpublished, got published_at=%v", *published)
	}
}

// An illegal transition must write NOTHING — the pure machine rejects it before any SQL
// runs, and the transaction rolls back clean.
func TestIllegalTransitionWritesNothing(t *testing.T) {
	pool := storagetest.NewPool(t, migrationsDir)
	svc := booking.NewService(pool)
	ctx := context.Background()

	bookingID := seedBooking(t, pool) // DRAFT

	// You cannot ARRIVE a booking that was never even confirmed.
	_, err := svc.Apply(ctx, bookingID, booking.ActionArrive, booking.TransitionInput{})

	var illegal *booking.IllegalTransitionError
	if !errors.As(err, &illegal) {
		t.Fatalf("Apply(ARRIVE) on DRAFT: error = %v, want *IllegalTransitionError", err)
	}

	assertCounts(t, pool, bookingID, "DRAFT", 0 /*version*/, 0 /*events*/, 0 /*outbox*/)
}

// The heart of the slice: two callers apply a legal transition to the SAME booking,
// concurrently. Exactly one must win. Without the version guard, both would succeed — two
// technicians, one kitchen.
//
// TWO GUARDS, and which one catches the loser depends on interleaving (this is a genuine
// property of the design, not a flaky test):
//   - both read version=2 before either commits -> the loser's CAS matches 0 rows ->
//     ConflictError.
//   - the loser's SELECT runs AFTER the winner commits -> under READ COMMITTED it reads
//     ASSIGNED, and the PURE state machine rejects ASSIGN from ASSIGNED ->
//     IllegalTransitionError.
//
// Either way there is exactly one winner and the durable state is consistent. The version
// guard and the state machine are belt and braces; the test asserts the invariant, not
// which belt held.
func TestConcurrentTransitionsExactlyOneWins(t *testing.T) {
	pool := storagetest.NewPool(t, migrationsDir)
	svc := booking.NewService(pool)
	ctx := context.Background()

	bookingID := seedBooking(t, pool)

	// Get it to SEARCHING, the state an admin ASSIGNs from.
	mustApply(t, svc, bookingID, booking.ActionConfirm)
	mustApply(t, svc, bookingID, booking.ActionSearch)

	tech := seedTechnician(t, pool)

	// Two goroutines race the same ASSIGN. Both read version=2 before either writes.
	var wg sync.WaitGroup
	results := make([]error, 2)
	start := make(chan struct{})
	for index := range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start // release both at once, to actually contend
			_, results[index] = svc.Apply(ctx, bookingID, booking.ActionAssign,
				booking.TransitionInput{AssignTechnician: &tech})
		}()
	}
	close(start)
	wg.Wait()

	winners, losers := 0, 0
	for _, err := range results {
		switch {
		case err == nil:
			winners++
		case isConflict(err) || isIllegalTransition(err):
			losers++ // both are legitimate "you lost the race" outcomes
		default:
			t.Fatalf("unexpected error: %v", err)
		}
	}
	if winners != 1 || losers != 1 {
		t.Fatalf("got %d winners and %d losers, want exactly 1 and 1", winners, losers)
	}

	// And the durable state proves only one assignment stuck: version 3, one ASSIGN event.
	var version, assignEvents int64
	if err := pool.QueryRow(ctx, "SELECT version FROM bookings WHERE id=$1", bookingID).Scan(&version); err != nil {
		t.Fatal(err)
	}
	if version != 3 {
		t.Errorf("version = %d, want 3 (CONFIRM, SEARCH, one ASSIGN)", version)
	}
	if err := pool.QueryRow(ctx,
		"SELECT count(*) FROM booking_events WHERE booking_id=$1 AND action='ASSIGN'", bookingID).
		Scan(&assignEvents); err != nil {
		t.Fatal(err)
	}
	if assignEvents != 1 {
		t.Errorf("ASSIGN events = %d, want exactly 1", assignEvents)
	}
}

func TestApplyOnMissingBookingReturnsNotFound(t *testing.T) {
	pool := storagetest.NewPool(t, migrationsDir)
	svc := booking.NewService(pool)

	_, err := svc.Apply(context.Background(), uuid.New(), booking.ActionConfirm, booking.TransitionInput{})
	if !errors.Is(err, booking.ErrBookingNotFound) {
		t.Fatalf("error = %v, want ErrBookingNotFound", err)
	}
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func mustApply(t *testing.T, svc *booking.Service, id uuid.UUID, action booking.Action) {
	t.Helper()
	if _, err := svc.Apply(context.Background(), id, action, booking.TransitionInput{}); err != nil {
		t.Fatalf("mustApply(%s): %v", action, err)
	}
}

func isConflict(err error) bool {
	var c *booking.ConflictError
	return errors.As(err, &c)
}

func isIllegalTransition(err error) bool {
	var index *booking.IllegalTransitionError
	return errors.As(err, &index)
}

func assertCounts(t *testing.T, pool *pgxpool.Pool, id uuid.UUID, wantState string, wantVersion, wantEvents, wantOutbox int64) {
	t.Helper()
	ctx := context.Background()

	var state string
	var version, events, outbox int64
	if err := pool.QueryRow(ctx, "SELECT state, version FROM bookings WHERE id=$1", id).Scan(&state, &version); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM booking_events WHERE booking_id=$1", id).Scan(&events); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM outbox WHERE aggregate_id=$1", id).Scan(&outbox); err != nil {
		t.Fatal(err)
	}
	if state != wantState || version != wantVersion || events != wantEvents || outbox != wantOutbox {
		t.Errorf("state=%s v=%d events=%d outbox=%d; want state=%s v=%d events=%d outbox=%d",
			state, version, events, outbox, wantState, wantVersion, wantEvents, wantOutbox)
	}
}

// seedBooking inserts a customer, an address, an order and a DRAFT booking, returning the
// booking id. Raw SQL: this is test scaffolding for OTHER modules' tables, and going
// through their services would couple this test to code it is not testing.
func seedBooking(t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()

	customerID := uuid.New()
	exec(t, pool, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Test Customer', 'CUSTOMER')",
		customerID, "+9190000"+customerID.String()[:5])

	addressID := uuid.New()
	exec(t, pool, `INSERT INTO addresses (id, user_id, line1, city, pincode, geog)
		VALUES ($1, $2, '1 Test Rd', 'Bengaluru', '560001', ST_MakePoint(77.5946, 12.9716)::geography)`,
		addressID, customerID)

	orderID := uuid.New()
	exec(t, pool, "INSERT INTO orders (id, customer_id) VALUES ($1, $2)", orderID, customerID)

	bookingID := uuid.New()
	exec(t, pool, "INSERT INTO bookings (id, order_id, customer_id, address_id) VALUES ($1, $2, $3, $4)",
		bookingID, orderID, customerID, addressID)

	return bookingID
}

func seedTechnician(t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()
	techID := uuid.New()
	exec(t, pool, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Test Tech', 'TECHNICIAN')",
		techID, "+9191000"+techID.String()[:5])
	exec(t, pool, "INSERT INTO technicians (user_id, city) VALUES ($1, 'Bengaluru')", techID)
	return techID
}

func exec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("seed exec failed: %v\n  sql: %s", err, sql)
	}
}
