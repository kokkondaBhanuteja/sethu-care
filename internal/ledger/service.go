package ledger

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage"
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
//   - UPI / ONLINE -> a PENDING payment collection (a booking-specific UPI QR). REVENUE is NOT
//     booked here; it is booked by CaptureUPIPayment when the money actually lands.
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

	// CASH lands with the technician, not the company account — record the custody debt now.
	if method == PaymentCash {
		if booking.TechnicianID == nil {
			return fmt.Errorf("ledger: cash completion for booking %s has no technician", bookingID)
		}
		methodStr := string(PaymentCash)
		customerID := booking.CustomerID
		if err := queries.InsertLedgerEntry(ctx, sqlcgen.InsertLedgerEntryParams{
			Kind:         string(EntryCashCustody),
			AmountPaise:  booking.QuotedTotalPaise,
			BookingID:    &bookingID,
			CustomerID:   &customerID,
			TechnicianID: booking.TechnicianID,
			Method:       &methodStr,
			Memo:         "cash collected on completion",
		}); err != nil {
			return fmt.Errorf("recording ledger entry: %w", err)
		}
		return nil
	}

	// UPI / ONLINE: the customer pays into the company account by scanning a booking-specific
	// UPI QR. We do NOT book REVENUE here — the money is not ours until it lands. Instead we
	// open a PENDING collection; REVENUE is booked when CaptureUPIPayment confirms it.
	_, err = queries.UpsertPendingPayment(ctx, sqlcgen.UpsertPendingPaymentParams{
		BookingID:   bookingID,
		OrderID:     booking.OrderID,
		AmountPaise: booking.QuotedTotalPaise,
		Reference:   paymentReference(bookingID),
	})
	if err != nil {
		return fmt.Errorf("opening upi collection: %w", err)
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

// Cash-reconciliation errors.
var (
	// ErrNoCustody — there is no cash held for this booking (not a cash job, or none recorded).
	ErrNoCustody = errors.New("ledger: no cash custody for this booking")
	// ErrNotYourCustody — a technician may only deposit cash they are holding (403).
	ErrNotYourCustody = errors.New("ledger: this cash is not held by you")
	// ErrAlreadyDeposited — the cash for this booking was already handed in (409).
	ErrAlreadyDeposited = errors.New("ledger: cash for this booking has already been deposited")
)

// CashPosition is one technician's cash standing: what they collected, deposited, and still owe.
type CashPosition struct {
	TechnicianID       uuid.UUID
	Name               string
	CollectedPaise     money.Money
	DepositedPaise     money.Money
	OutstandingPaise   money.Money
	OldestCollectionAt *time.Time
}

// RecordDeposit records that a technician handed in the cash they were holding for a booking —
// a CASH_DEPOSIT that offsets the CASH_CUSTODY, closing the loop the reconciliation view tracks.
func (service *Service) RecordDeposit(ctx context.Context, bookingID, technicianID uuid.UUID) error {
	queries := sqlcgen.New(service.pool)

	custody, err := queries.GetBookingCashCustody(ctx, &bookingID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNoCustody
	}
	if err != nil {
		return fmt.Errorf("reading custody: %w", err)
	}
	if custody.TechnicianID == nil || *custody.TechnicianID != technicianID {
		return ErrNotYourCustody
	}

	deposited, err := queries.DepositExistsForBooking(ctx, &bookingID)
	if err != nil {
		return fmt.Errorf("checking deposit: %w", err)
	}
	if deposited {
		return ErrAlreadyDeposited
	}

	method := string(PaymentCash)
	if err := queries.InsertLedgerEntry(ctx, sqlcgen.InsertLedgerEntryParams{
		Kind:         string(EntryCashDeposit),
		AmountPaise:  custody.AmountPaise,
		BookingID:    &bookingID,
		TechnicianID: &technicianID,
		Method:       &method,
		Memo:         "cash deposited",
	}); err != nil {
		return fmt.Errorf("recording deposit: %w", err)
	}
	return nil
}

// Reconciliation returns every technician who still owes a cash deposit, oldest first.
func (service *Service) Reconciliation(ctx context.Context) ([]CashPosition, error) {
	rows, err := sqlcgen.New(service.pool).ListCashReconciliation(ctx)
	if err != nil {
		return nil, fmt.Errorf("reading reconciliation: %w", err)
	}
	positions := make([]CashPosition, len(rows))
	for index, row := range rows {
		var technicianID uuid.UUID
		if row.TechnicianID != nil {
			technicianID = *row.TechnicianID
		}
		positions[index] = CashPosition{
			TechnicianID:       technicianID,
			Name:               row.Name,
			CollectedPaise:     row.CollectedPaise,
			DepositedPaise:     row.DepositedPaise,
			OutstandingPaise:   row.OutstandingPaise,
			OldestCollectionAt: timePointer(row.OldestCollectionAt),
		}
	}
	return positions, nil
}

// PositionForTechnician returns one technician's own cash standing (for the provider app's
// cash-held summary). A technician who has never collected cash has no ledger rows, which reads as
// an all-zero position rather than an error.
func (service *Service) PositionForTechnician(ctx context.Context, technicianID uuid.UUID) (CashPosition, error) {
	row, err := sqlcgen.New(service.pool).GetTechnicianCashPosition(ctx, &technicianID)
	if errors.Is(err, pgx.ErrNoRows) {
		return CashPosition{TechnicianID: technicianID}, nil
	}
	if err != nil {
		return CashPosition{}, fmt.Errorf("reading cash position: %w", err)
	}
	return CashPosition{
		TechnicianID:     technicianID,
		CollectedPaise:   row.CollectedPaise,
		DepositedPaise:   row.DepositedPaise,
		OutstandingPaise: row.OutstandingPaise,
	}, nil
}

func timePointer(timestamp pgtype.Timestamptz) *time.Time {
	if !timestamp.Valid {
		return nil
	}
	return &timestamp.Time
}

// ErrPaymentNotFound is returned when a capture or read names a collection that does not exist.
var ErrPaymentNotFound = errors.New("ledger: payment not found")

// Collection is a UPI payment we are collecting for a booking: the amount, our reference (the
// UPI `tr`), and where it stands. CustomerID and TechnicianID ride along so a read can be
// authorized to the owning customer or the assigned technician.
type Collection struct {
	Reference    string
	Amount       money.Money
	Status       PaymentStatus
	BookingID    uuid.UUID
	OrderID      uuid.UUID
	CustomerID   uuid.UUID
	TechnicianID *uuid.UUID
}

// CollectionForBooking returns the UPI collection opened for a booking, for the customer (or the
// assigned technician) to render the QR. ErrPaymentNotFound if the booking has no collection —
// it was cash, a warranty job, or is not yet completed.
func (service *Service) CollectionForBooking(ctx context.Context, bookingID uuid.UUID) (Collection, error) {
	row, err := sqlcgen.New(service.pool).GetPaymentByBooking(ctx, bookingID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Collection{}, ErrPaymentNotFound
	}
	if err != nil {
		return Collection{}, fmt.Errorf("reading collection: %w", err)
	}
	return Collection{
		Reference:    row.Reference,
		Amount:       row.AmountPaise,
		Status:       PaymentStatus(row.Status),
		BookingID:    row.BookingID,
		OrderID:      row.OrderID,
		CustomerID:   row.CustomerID,
		TechnicianID: row.TechnicianID,
	}, nil
}

// CaptureUPIPayment records that the customer's UPI payment landed in the company account. It
// is the money-moved moment: it marks the collection CAPTURED and books REVENUE against the
// order, atomically. In production the caller is the PSP webhook; in P1 an admin confirms it.
//
// Idempotent: a redelivered/duplicate capture (already CAPTURED, or REVENUE already booked)
// records nothing further.
func (service *Service) CaptureUPIPayment(ctx context.Context, reference string, providerRef *string) error {
	queries := sqlcgen.New(service.pool)

	payment, err := queries.GetPaymentByReference(ctx, reference)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrPaymentNotFound
	}
	if err != nil {
		return fmt.Errorf("reading payment: %w", err)
	}
	if payment.Status == string(PaymentCaptured) {
		return nil // already captured
	}

	booking, err := queries.GetBooking(ctx, payment.BookingID)
	if err != nil {
		return fmt.Errorf("reading booking for capture: %w", err)
	}

	// Mark captured and book REVENUE together — the money-moved record and the ledger cannot
	// disagree.
	return storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		inTx := queries.WithTx(tx)

		// Guard against double-booking REVENUE if two captures race past the status check.
		alreadyBooked, err := inTx.CompletionLedgerExists(ctx, sqlcgen.CompletionLedgerExistsParams{
			OrderID:   &payment.OrderID,
			BookingID: &payment.BookingID,
		})
		if err != nil {
			return fmt.Errorf("checking existing revenue: %w", err)
		}
		if !alreadyBooked {
			methodStr := string(PaymentUPI)
			customerID := booking.CustomerID
			if err := inTx.InsertLedgerEntry(ctx, sqlcgen.InsertLedgerEntryParams{
				Kind:        string(EntryRevenue),
				AmountPaise: payment.AmountPaise,
				OrderID:     &payment.OrderID,
				CustomerID:  &customerID,
				Method:      &methodStr,
				Memo:        "upi payment captured",
			}); err != nil {
				return fmt.Errorf("recording revenue: %w", err)
			}
		}

		if err := inTx.MarkPaymentCaptured(ctx, sqlcgen.MarkPaymentCapturedParams{
			Reference:   reference,
			ProviderRef: providerRef,
		}); err != nil {
			return fmt.Errorf("marking captured: %w", err)
		}
		return nil
	})
}

// paymentReference derives the UPI transaction reference from the booking id — deterministic, so
// opening a collection is idempotent, and unique, so a capture maps to exactly one booking. It
// fits inside the UPI `tr` length limit (2 + 32 hex = 34 chars).
func paymentReference(bookingID uuid.UUID) string {
	return "SC" + strings.ReplaceAll(bookingID.String(), "-", "")
}
