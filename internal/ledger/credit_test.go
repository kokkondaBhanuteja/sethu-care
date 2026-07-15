package ledger_test

import (
	"context"
	"testing"

	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
)

// A FAILED booking gets a goodwill credit against the order; a redelivery does not double it.
func TestFailureCreditIsIdempotent(t *testing.T) {
	pool := storagetest.NewPool(t, migrationsDir)
	ctx := context.Background()
	ledgerService := ledger.NewService(pool)

	bookingID, orderID, _ := seedCompletedBooking(t, pool, "599")
	credit := money.FromPaise(10000) // ₹100

	if err := ledgerService.IssueFailureCredit(ctx, bookingID, credit); err != nil {
		t.Fatalf("IssueFailureCredit: %v", err)
	}
	if err := ledgerService.IssueFailureCredit(ctx, bookingID, credit); err != nil {
		t.Fatalf("second IssueFailureCredit: %v", err)
	}

	var count int
	var amount int64
	if err := pool.QueryRow(ctx,
		"SELECT count(*), COALESCE(max(amount_paise),0) FROM ledger_entries WHERE order_id=$1 AND kind='CREDIT_ISSUED'", orderID).
		Scan(&count, &amount); err != nil {
		t.Fatal(err)
	}
	if count != 1 || amount != 10000 {
		t.Errorf("credit entries = %d amount = %d, want 1 and 10000", count, amount)
	}
}
