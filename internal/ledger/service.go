package ledger

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/money"

	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// ErrBookingNotFound is returned when a completion names a booking that does not exist.
var ErrBookingNotFound = errors.New("ledger: booking not found")

// Service records the money side of the business (ROADMAP §6). The ledger is append-only —
// enforced by a database trigger — so this only ever INSERTs.
type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// RecordCompletion writes the ledger entry for a completed booking, given how the customer
// paid. It is the booking.completed consumer, so it must be IDEMPOTENT (at-least-once
// delivery): if the booking is already billed, it does nothing.
//
//   - UPI / ONLINE -> REVENUE, attached to the ORDER. The money is in the company account.
//   - CASH         -> CASH_CUSTODY, attached to the booking AND the technician. They are now
//     holding company money and owe a deposit (the reconciliation screen tracks the gap).
//   - a warranty job (quoted total is zero) resolves to no entry at all — there was no payment.
func (service *Service) RecordCompletion(ctx context.Context, bookingID uuid.UUID, method PaymentMethod) error {
	if !method.Valid() {
		return fmt.Errorf("ledger: invalid payment method %q", method)
	}
	queries := sqlcgen.New(service.pool)

	booking, err := queries.GetBooking(ctx, bookingID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrBookingNotFound
	}
	if err != nil {
		return fmt.Errorf("reading booking: %w", err)
	}

	// Warranty: nothing was charged, so there is nothing to record.
	if booking.QuotedTotalPaise.IsZero() {
		return nil
	}

	// Idempotency: already billed? (a redelivered booking.completed, or a retry).
	alreadyBilled, err := queries.CompletionLedgerExists(ctx, sqlcgen.CompletionLedgerExistsParams{
		OrderID:   &booking.OrderID,
		BookingID: &bookingID,
	})
	if err != nil {
		return fmt.Errorf("checking existing ledger entry: %w", err)
	}
	if alreadyBilled {
		return nil
	}

	methodStr := string(method)
	orderID := booking.OrderID
	customerID := booking.CustomerID

	entry := sqlcgen.InsertLedgerEntryParams{
		AmountPaise: booking.QuotedTotalPaise,
		CustomerID:  &customerID,
		Method:      &methodStr,
	}
	if method == PaymentCash {
		// Cash lands with the technician, not the company account.
		if booking.TechnicianID == nil {
			return fmt.Errorf("ledger: cash completion for booking %s has no technician", bookingID)
		}
		entry.Kind = string(EntryCashCustody)
		entry.BookingID = &bookingID
		entry.TechnicianID = booking.TechnicianID
		entry.Memo = "cash collected on completion"
	} else {
		entry.Kind = string(EntryRevenue)
		entry.OrderID = &orderID
		entry.Memo = "paid on completion via " + methodStr
	}

	if err := queries.InsertLedgerEntry(ctx, entry); err != nil {
		return fmt.Errorf("recording ledger entry: %w", err)
	}
	return nil
}

// IssueFailureCredit records a goodwill CREDIT_ISSUED for a booking that FAILED — nobody could
// be found, so we owe the customer an apology credit (ROADMAP §6, §8). Attaches to the order
// (the CHECK requires it). Idempotent: a redelivered booking.failed does not double-credit.
func (service *Service) IssueFailureCredit(ctx context.Context, bookingID uuid.UUID, amount money.Money) error {
	if amount.IsZero() {
		return nil
	}
	queries := sqlcgen.New(service.pool)

	booking, err := queries.GetBooking(ctx, bookingID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrBookingNotFound
	}
	if err != nil {
		return fmt.Errorf("reading booking: %w", err)
	}

	alreadyCredited, err := queries.CreditExistsForOrder(ctx, &booking.OrderID)
	if err != nil {
		return fmt.Errorf("checking existing credit: %w", err)
	}
	if alreadyCredited {
		return nil
	}

	orderID := booking.OrderID
	customerID := booking.CustomerID
	if err := queries.InsertLedgerEntry(ctx, sqlcgen.InsertLedgerEntryParams{
		Kind:        string(EntryCreditIssued),
		AmountPaise: amount,
		OrderID:     &orderID,
		CustomerID:  &customerID,
		Memo:        "goodwill credit — we could not find a technician",
	}); err != nil {
		return fmt.Errorf("recording credit: %w", err)
	}
	return nil
}
