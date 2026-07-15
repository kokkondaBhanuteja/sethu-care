package ops_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ops"
	"github.com/kokkondaBhanuteja/sethu-care/internal/outbox"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
)

const migrationsDir = "../../db/migrations"

// Confirming a booking makes it search for a technician on its own: the booking.confirmed
// event is delivered by the outbox worker to StartSearch, which moves CONFIRMED -> SEARCHING.
func TestConfirmAutoDrainsToSearchingViaOutbox(t *testing.T) {
	pool := storagetest.NewPool(t, migrationsDir)
	ctx := context.Background()

	bookingService := booking.NewService(pool)
	opsService := ops.New(pool, bookingService)
	bookingID, customerID := seedConfirmableBooking(t, pool, bookingService)

	// CONFIRM (as the customer) — this publishes booking.confirmed to the outbox.
	if _, err := bookingService.Apply(ctx, bookingID, booking.ActionConfirm, booking.TransitionInput{
		Actor: &customerID, ActorRole: identity.RoleCustomer,
	}); err != nil {
		t.Fatalf("CONFIRM: %v", err)
	}
	assertState(t, pool, bookingID, "CONFIRMED") // not searching yet — the worker hasn't run

	// Run the worker with the auto-search consumer wired, exactly as main does.
	worker := newWorkerWithAutoSearch(pool, opsService)
	if _, err := worker.Poll(ctx); err != nil {
		t.Fatalf("Poll: %v", err)
	}

	assertState(t, pool, bookingID, "SEARCHING") // the booking searched for itself
}

// At-least-once delivery: the same booking.confirmed handled twice must NOT error and must
// NOT double-transition. The second StartSearch sees a SEARCHING booking (SEARCH is illegal
// from there) and treats it as done.
func TestAutoSearchIsIdempotent(t *testing.T) {
	pool := storagetest.NewPool(t, migrationsDir)
	ctx := context.Background()

	bookingService := booking.NewService(pool)
	opsService := ops.New(pool, bookingService)
	bookingID, customerID := seedConfirmableBooking(t, pool, bookingService)

	if _, err := bookingService.Apply(ctx, bookingID, booking.ActionConfirm, booking.TransitionInput{
		Actor: &customerID, ActorRole: identity.RoleCustomer,
	}); err != nil {
		t.Fatalf("CONFIRM: %v", err)
	}

	// First call moves it to SEARCHING.
	if err := opsService.StartSearch(ctx, bookingID); err != nil {
		t.Fatalf("first StartSearch: %v", err)
	}
	// Second call (a redelivery) is a no-op success — the booking already moved on.
	if err := opsService.StartSearch(ctx, bookingID); err != nil {
		t.Fatalf("redelivered StartSearch should be a no-op, got: %v", err)
	}
	assertState(t, pool, bookingID, "SEARCHING")

	// A booking.confirmed for a booking that never existed is also a no-op, not a retry loop.
	if err := opsService.StartSearch(ctx, uuid.New()); err != nil {
		t.Errorf("StartSearch for a missing booking should be a no-op, got: %v", err)
	}
}

// ---------------------------------------------------------------------------

func newWorkerWithAutoSearch(pool *pgxpool.Pool, opsService *ops.Service) *outbox.Worker {
	dispatcher := outbox.NewDispatcher()
	dispatcher.Subscribe("booking.confirmed", func(ctx context.Context, event outbox.Event) error {
		return opsService.StartSearch(ctx, event.AggregateID)
	})
	return outbox.NewWorker(pool, dispatcher)
}

// seedConfirmableBooking creates the catalog + customer + address a booking needs, then a
// DRAFT booking via the real service, and returns the booking and customer ids.
func seedConfirmableBooking(t *testing.T, pool *pgxpool.Pool, bookingService *booking.Service) (bookingID, customerID uuid.UUID) {
	t.Helper()
	ctx := context.Background()

	customerID = uuid.New()
	exec(t, pool, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Ravi', 'CUSTOMER')", customerID, "+9190"+customerID.String()[:8])
	addressID := uuid.New()
	exec(t, pool, `INSERT INTO addresses (id, user_id, line1, city, pincode, geog)
		VALUES ($1, $2, '1 Rd', 'Bengaluru', '560001', ST_MakePoint(77.59,12.97)::geography)`, addressID, customerID)
	categoryID, serviceID, variantID := uuid.New(), uuid.New(), uuid.New()
	exec(t, pool, "INSERT INTO categories (id, name, slug) VALUES ($1, 'AC', 'ac')", categoryID)
	exec(t, pool, "INSERT INTO services (id, category_id, name, slug) VALUES ($1, $2, 'AC Service', 'ac-svc')", serviceID, categoryID)
	exec(t, pool, "INSERT INTO service_variants (id, service_id, name, base_price_paise) VALUES ($1, $2, 'Standard', 59900)", variantID, serviceID)

	created, err := bookingService.Create(ctx, booking.CreateInput{
		CustomerID: customerID, AddressID: addressID, VariantID: variantID, Quantity: 1,
	})
	if err != nil {
		t.Fatalf("Create booking: %v", err)
	}
	return created.BookingID, customerID
}

func assertState(t *testing.T, pool *pgxpool.Pool, bookingID uuid.UUID, want string) {
	t.Helper()
	var state string
	if err := pool.QueryRow(context.Background(), "SELECT state FROM bookings WHERE id=$1", bookingID).Scan(&state); err != nil {
		t.Fatal(err)
	}
	if state != want {
		t.Errorf("booking state = %s, want %s", state, want)
	}
}

func exec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("seed exec: %v\n  %s", err, sql)
	}
}
