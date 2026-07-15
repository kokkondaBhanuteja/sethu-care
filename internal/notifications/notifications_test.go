package notifications_test

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/notifications"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
)

const migrationsDir = "../../db/migrations"

// An event with a customer-facing message records exactly one notification; a redelivery
// records nothing (the unique index makes it idempotent); an event with no message records
// nothing at all.
func TestNotifyRecordsOncePerBookingEvent(t *testing.T) {
	pool := storagetest.NewPool(t, migrationsDir)
	ctx := context.Background()
	service := notifications.NewService(pool, discardLogger())

	customerID, bookingID := seedBooking(t, pool)

	// A customer-facing event.
	if err := service.Notify(ctx, "booking.assigned", bookingID); err != nil {
		t.Fatalf("Notify: %v", err)
	}
	// Redelivery — must not duplicate.
	if err := service.Notify(ctx, "booking.assigned", bookingID); err != nil {
		t.Fatalf("redelivered Notify: %v", err)
	}
	assertNotificationCount(t, pool, bookingID, "booking.assigned", 1)

	// A different event -> its own notification.
	if err := service.Notify(ctx, "booking.completed", bookingID); err != nil {
		t.Fatalf("Notify completed: %v", err)
	}
	assertNotificationCount(t, pool, bookingID, "booking.completed", 1)

	// An event with no customer message -> nothing recorded.
	if err := service.Notify(ctx, "booking.created", bookingID); err != nil {
		t.Fatalf("Notify created: %v", err)
	}
	assertNotificationCount(t, pool, bookingID, "booking.created", 0)

	// The recipient is the customer.
	var recipient uuid.UUID
	if err := pool.QueryRow(ctx,
		"SELECT recipient_id FROM notification_log WHERE booking_id=$1 AND event_type='booking.assigned'", bookingID).
		Scan(&recipient); err != nil {
		t.Fatal(err)
	}
	if recipient != customerID {
		t.Errorf("recipient = %s, want the customer %s", recipient, customerID)
	}
}

// ---------------------------------------------------------------------------

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func seedBooking(t *testing.T, pool *pgxpool.Pool) (customerID, bookingID uuid.UUID) {
	t.Helper()
	ctx := context.Background()
	customerID = uuid.New()
	exec(t, pool, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Ravi', 'CUSTOMER')", customerID, "+9190"+customerID.String()[:8])
	addressID := uuid.New()
	exec(t, pool, `INSERT INTO addresses (id, user_id, line1, city, pincode, geog)
		VALUES ($1, $2, '1 Rd', 'Bengaluru', '560001', ST_MakePoint(77.59,12.97)::geography)`, addressID, customerID)
	orderID := uuid.New()
	exec(t, pool, "INSERT INTO orders (id, customer_id) VALUES ($1, $2)", orderID, customerID)
	bookingID = uuid.New()
	exec(t, pool, "INSERT INTO bookings (id, order_id, customer_id, address_id) VALUES ($1, $2, $3, $4)", bookingID, orderID, customerID, addressID)
	_ = ctx
	return customerID, bookingID
}

func assertNotificationCount(t *testing.T, pool *pgxpool.Pool, bookingID uuid.UUID, eventType string, want int) {
	t.Helper()
	var count int
	if err := pool.QueryRow(context.Background(),
		"SELECT count(*) FROM notification_log WHERE booking_id=$1 AND event_type=$2", bookingID, eventType).
		Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != want {
		t.Errorf("notifications for %s = %d, want %d", eventType, count, want)
	}
}

func exec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("seed exec: %v\n  %s", err, sql)
	}
}
