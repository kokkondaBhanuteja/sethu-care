package ledger

// The admin console's view of how a booking was actually paid. Composed from the two records
// the money side keeps: the REVENUE ledger row (money moved — UPI or cash) and the payments
// row (the UPI collection, which may still be pending).

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// PaymentFacts is what is truthfully known about a booking's payment.
type PaymentFacts struct {
	// Found is false when no payment record of any kind exists yet (the job has not
	// completed, or completed without a collection).
	Found  bool
	Method PaymentMethod
	Amount money.Money
	// PaidAt is nil while a collection is still pending — money has not moved.
	PaidAt *time.Time
	// TransactionID is the PSP reference when one exists, else our own collection reference.
	TransactionID string
}

// PaymentFactsForBooking reads the payment story for one booking, in evidence order:
//   - a REVENUE row against the order (a captured UPI payment — P1: one booking per order),
//   - else a CASH_CUSTODY row (cash handed to the technician at completion),
//   - else a pending UPI collection, reported without a paid-at — never as done,
//   - else Found=false: the job has not been paid for (or not completed) yet.
func (service *Service) PaymentFactsForBooking(ctx context.Context, bookingID, orderID uuid.UUID) (PaymentFacts, error) {
	queries := sqlcgen.New(service.pool)

	collection, collectionErr := queries.GetPaymentByBooking(ctx, bookingID)
	if collectionErr != nil && !errors.Is(collectionErr, pgx.ErrNoRows) {
		return PaymentFacts{}, fmt.Errorf("reading collection for booking: %w", collectionErr)
	}
	haveCollection := collectionErr == nil
	transactionID := ""
	if haveCollection {
		transactionID = collection.Reference
		if collection.ProviderRef != nil && *collection.ProviderRef != "" {
			transactionID = *collection.ProviderRef
		}
	}

	revenue, err := queries.GetRevenueEntryForOrder(ctx, &orderID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return PaymentFacts{}, fmt.Errorf("reading revenue entry for order: %w", err)
	}
	if err == nil {
		// Money moved: the ledger row is the truth for method, amount and time.
		facts := PaymentFacts{Found: true, Method: PaymentUPI, Amount: revenue.AmountPaise, TransactionID: transactionID}
		if revenue.Method != nil {
			if method, parseErr := ParsePaymentMethod(*revenue.Method); parseErr == nil {
				facts.Method = method
			}
		}
		paidAt := revenue.CreatedAt.Time
		if haveCollection && collection.CapturedAt.Valid {
			paidAt = collection.CapturedAt.Time
		}
		facts.PaidAt = &paidAt
		return facts, nil
	}

	custody, err := queries.GetBookingCashCustody(ctx, &bookingID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return PaymentFacts{}, fmt.Errorf("reading cash custody for booking: %w", err)
	}
	if err == nil {
		// Cash was collected at the door; the custody row records when the customer paid.
		paidAt := custody.CreatedAt.Time
		return PaymentFacts{Found: true, Method: PaymentCash, Amount: custody.AmountPaise, PaidAt: &paidAt}, nil
	}

	if haveCollection {
		// A UPI collection is open but unconfirmed — pending, never reported as paid.
		return PaymentFacts{Found: true, Method: PaymentUPI, Amount: collection.AmountPaise, TransactionID: transactionID}, nil
	}
	return PaymentFacts{}, nil
}
