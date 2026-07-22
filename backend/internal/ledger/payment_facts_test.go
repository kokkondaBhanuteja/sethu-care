package ledger_test

import (
	"context"
	"testing"

	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
)

// PaymentFacts reports only what the money records prove. Each test seeds its own database
// (seedCompletedBooking's catalog rows are one-per-schema).

func TestPaymentFactsBeforeAnyRecord(t *testing.T) {
	pool := storagetest.NewPool(t, "../../db/migrations")
	ctx := context.Background()
	service := ledger.NewService(pool)

	bookingID, orderID, _ := seedCompletedBooking(t, pool, "599")
	facts, err := service.PaymentFactsForBooking(ctx, bookingID, orderID)
	if err != nil {
		t.Fatalf("facts before any record: %v", err)
	}
	if facts.Found {
		t.Errorf("facts before any record = %+v, want Found=false", facts)
	}
}

// Cash: the custody row is the customer's payment, timestamped at collection.
func TestPaymentFactsForCashCollection(t *testing.T) {
	pool := storagetest.NewPool(t, "../../db/migrations")
	ctx := context.Background()
	service := ledger.NewService(pool)

	bookingID, orderID, _ := seedCompletedBooking(t, pool, "800")
	if err := service.RecordCompletion(ctx, bookingID, ledger.PaymentCash); err != nil {
		t.Fatalf("RecordCompletion cash: %v", err)
	}
	facts, err := service.PaymentFactsForBooking(ctx, bookingID, orderID)
	if err != nil {
		t.Fatalf("cash facts: %v", err)
	}
	if !facts.Found || facts.Method != ledger.PaymentCash || facts.PaidAt == nil {
		t.Errorf("cash facts = %+v, want found CASH with a paid-at", facts)
	}
	if facts.Amount.Paise() != 80000 {
		t.Errorf("cash amount = %d, want 80000", facts.Amount.Paise())
	}
}

// UPI: pending until captured — PaidAt must stay nil while the money has not moved, then
// carry the capture with the PSP reference once it has.
func TestPaymentFactsForUPICollectionAndCapture(t *testing.T) {
	pool := storagetest.NewPool(t, "../../db/migrations")
	ctx := context.Background()
	service := ledger.NewService(pool)

	bookingID, orderID, _ := seedCompletedBooking(t, pool, "599")
	if err := service.RecordCompletion(ctx, bookingID, ledger.PaymentUPI); err != nil {
		t.Fatalf("RecordCompletion upi: %v", err)
	}
	facts, err := service.PaymentFactsForBooking(ctx, bookingID, orderID)
	if err != nil {
		t.Fatalf("pending upi facts: %v", err)
	}
	if !facts.Found || facts.Method != ledger.PaymentUPI || facts.PaidAt != nil {
		t.Errorf("pending upi facts = %+v, want found UPI with no paid-at", facts)
	}
	if facts.TransactionID == "" {
		t.Error("pending upi facts carry no reference")
	}

	collection, err := service.CollectionForBooking(ctx, bookingID)
	if err != nil {
		t.Fatalf("CollectionForBooking: %v", err)
	}
	providerRef := "pay_ABC123"
	if err := service.CaptureUPIPayment(ctx, collection.Reference, &providerRef); err != nil {
		t.Fatalf("CaptureUPIPayment: %v", err)
	}
	facts, err = service.PaymentFactsForBooking(ctx, bookingID, orderID)
	if err != nil {
		t.Fatalf("captured upi facts: %v", err)
	}
	if !facts.Found || facts.Method != ledger.PaymentUPI || facts.PaidAt == nil {
		t.Errorf("captured upi facts = %+v, want found UPI with a paid-at", facts)
	}
	if facts.TransactionID != providerRef {
		t.Errorf("transaction id = %q, want the PSP reference %q", facts.TransactionID, providerRef)
	}
	if facts.Amount.Paise() != 59900 {
		t.Errorf("captured amount = %d, want 59900", facts.Amount.Paise())
	}
}
