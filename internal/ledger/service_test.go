package ledger_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
)

const migrationsDir = "../../db/migrations"

// A UPI/online completion records a REVENUE entry against the order; re-running (a redelivery)
// does not double-bill.
func TestRecordCompletionRevenueIsIdempotent(t *testing.T) {
	pool := storagetest.NewPool(t, migrationsDir)
	ctx := context.Background()
	ledgerService := ledger.NewService(pool)

	bookingID, orderID, _ := seedCompletedBooking(t, pool, "599")

	if err := ledgerService.RecordCompletion(ctx, bookingID, ledger.PaymentUPI); err != nil {
		t.Fatalf("RecordCompletion: %v", err)
	}
	// Redelivery: at-least-once means this can be called again. It must NOT add a second row.
	if err := ledgerService.RecordCompletion(ctx, bookingID, ledger.PaymentUPI); err != nil {
		t.Fatalf("second RecordCompletion: %v", err)
	}

	kind, amount, count := revenueForOrder(t, pool, orderID)
	if count != 1 {
		t.Fatalf("REVENUE rows for order = %d, want exactly 1 (idempotent)", count)
	}
	if kind != "REVENUE" || amount != 59900 {
		t.Errorf("entry = (%s, %d), want (REVENUE, 59900)", kind, amount)
	}
}

// A cash completion records CASH_CUSTODY against the technician — the money is in their
// pocket, a debt to the company that the reconciliation view tracks.
func TestRecordCompletionCashGoesToCustody(t *testing.T) {
	pool := storagetest.NewPool(t, migrationsDir)
	ctx := context.Background()
	ledgerService := ledger.NewService(pool)

	bookingID, _, technicianID := seedCompletedBooking(t, pool, "800")

	if err := ledgerService.RecordCompletion(ctx, bookingID, ledger.PaymentCash); err != nil {
		t.Fatalf("RecordCompletion: %v", err)
	}

	var kind, method string
	var amount int64
	var tech uuid.UUID
	if err := pool.QueryRow(ctx,
		"SELECT kind, method, amount_paise, technician_id FROM ledger_entries WHERE booking_id=$1", bookingID).
		Scan(&kind, &method, &amount, &tech); err != nil {
		t.Fatal(err)
	}
	if kind != "CASH_CUSTODY" || method != "CASH" || amount != 80000 || tech != technicianID {
		t.Errorf("cash entry = (%s, %s, %d, %s), want (CASH_CUSTODY, CASH, 80000, %s)", kind, method, amount, tech, technicianID)
	}

	// The reconciliation view shows the technician owes this amount.
	var outstanding int64
	if err := pool.QueryRow(ctx,
		"SELECT outstanding_paise FROM technician_cash_position WHERE technician_id=$1", technicianID).
		Scan(&outstanding); err != nil {
		t.Fatal(err)
	}
	if outstanding != 80000 {
		t.Errorf("outstanding = %d, want 80000", outstanding)
	}
}

// A warranty job (zero total) records nothing — there was no payment.
func TestWarrantyJobRecordsNothing(t *testing.T) {
	pool := storagetest.NewPool(t, migrationsDir)
	ctx := context.Background()
	ledgerService := ledger.NewService(pool)

	bookingID, _, _ := seedCompletedBooking(t, pool, "0")

	if err := ledgerService.RecordCompletion(ctx, bookingID, ledger.PaymentUPI); err != nil {
		t.Fatalf("RecordCompletion: %v", err)
	}
	var count int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM ledger_entries WHERE booking_id=$1 OR order_id=(SELECT order_id FROM bookings WHERE id=$1)", bookingID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Errorf("warranty job recorded %d ledger entries, want 0", count)
	}
}

// ---------------------------------------------------------------------------

// seedCompletedBooking builds the catalog + customer + technician, creates a booking at the
// given rupee price via the real service, assigns a technician, and returns the ids. It does
// not walk the whole lifecycle — the ledger service only needs a booking with an order,
// total, and technician.
func seedCompletedBooking(t *testing.T, pool *pgxpool.Pool, rupees string) (bookingID, orderID, technicianID uuid.UUID) {
	t.Helper()
	ctx := context.Background()
	bookingService := booking.NewService(pool)

	customerID := uuid.New()
	exec(t, pool, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Ravi', 'CUSTOMER')", customerID, "+9190"+customerID.String()[:8])
	addressID := uuid.New()
	exec(t, pool, `INSERT INTO addresses (id, user_id, line1, city, pincode, geog)
		VALUES ($1, $2, '1 Rd', 'Bengaluru', '560001', ST_MakePoint(77.59,12.97)::geography)`, addressID, customerID)
	categoryID, serviceID, variantID := uuid.New(), uuid.New(), uuid.New()
	exec(t, pool, "INSERT INTO categories (id, name, slug) VALUES ($1, 'AC', 'ac')", categoryID)
	exec(t, pool, "INSERT INTO services (id, category_id, name, slug) VALUES ($1, $2, 'AC Service', 'ac-svc')", serviceID, categoryID)
	price := rupeesToPaise(t, rupees)
	exec(t, pool, "INSERT INTO service_variants (id, service_id, name, base_price_paise) VALUES ($1, $2, 'Standard', $3)", variantID, serviceID, price)

	technicianID = uuid.New()
	exec(t, pool, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Asha', 'TECHNICIAN')", technicianID, "+9191"+technicianID.String()[:8])
	exec(t, pool, "INSERT INTO technicians (user_id, city) VALUES ($1, 'Bengaluru')", technicianID)

	created, err := bookingService.Create(ctx, booking.CreateInput{
		CustomerID: customerID, AddressID: addressID, VariantID: variantID, Quantity: 1,
	})
	if err != nil {
		t.Fatalf("Create booking: %v", err)
	}
	// Attach the technician directly (the ledger doesn't care how it got assigned).
	exec(t, pool, "UPDATE bookings SET technician_id=$1 WHERE id=$2", technicianID, created.BookingID)

	return created.BookingID, created.OrderID, technicianID
}

func rupeesToPaise(t *testing.T, rupees string) int64 {
	t.Helper()
	switch rupees {
	case "599":
		return 59900
	case "800":
		return 80000
	case "0":
		return 0
	default:
		t.Fatalf("unhandled seed price %q", rupees)
		return 0
	}
}

func revenueForOrder(t *testing.T, pool *pgxpool.Pool, orderID uuid.UUID) (kind string, amount int64, count int) {
	t.Helper()
	ctx := context.Background()
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM ledger_entries WHERE order_id=$1 AND kind='REVENUE'", orderID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count > 0 {
		if err := pool.QueryRow(ctx, "SELECT kind, amount_paise FROM ledger_entries WHERE order_id=$1 AND kind='REVENUE' LIMIT 1", orderID).Scan(&kind, &amount); err != nil {
			t.Fatal(err)
		}
	}
	return kind, amount, count
}

func exec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("seed exec: %v\n  %s", err, sql)
	}
}
