package ledger

// The admin console's refund leg. All admin-decided money — a refund from the refund screen,
// the refund a cancellation records, and the reversal an undo-cancel writes — lands here as
// append-only CREDIT rows. Corrections are offsetting entries (CREDIT_REDEEMED pointing at
// the credit it takes back), never mutations, exactly as the ledger's trigger demands.

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/kokkondaBhanuteja/sethu-care/internal/audit"
	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// AdminCreditInput is one admin-decided credit against a booking's order.
type AdminCreditInput struct {
	// CreditID is minted by the caller so the receipt can name the credit before it exists;
	// it becomes the ledger row's id.
	CreditID  uuid.UUID
	BookingID uuid.UUID
	// AdminID is the operator who decided the money; recorded in the audit trail.
	AdminID uuid.UUID
	Amount  money.Money
	// Memo lands verbatim on the ledger row — the reason code and note travel in it.
	Memo string
	// AuditAction names the trail entry ("REFUND" for the refund screen, "CANCEL_REFUND"
	// for the refund a cancellation records). The refund rate limit counts "REFUND" rows.
	AuditAction string
	// AuditDetail is the structured after-snapshot for the trail (reason code, payout
	// impact, refund type, …).
	AuditDetail map[string]string
	// ReplayKeyID + ReplayReceipt, when set, store the idempotent-replay record in the SAME
	// transaction as the credit — so a retried refund can never write a second credit.
	ReplayKeyID   *uuid.UUID
	ReplayReceipt any
}

// AdminCredit is the recorded credit.
type AdminCredit struct {
	CreditID   uuid.UUID
	RecordedAt time.Time
}

// RecordAdminCredit writes one CREDIT_ISSUED for the booking's order, with its audit trail
// entry (and, for the refund screen, its replay record) in the same transaction.
func (service *Service) RecordAdminCredit(ctx context.Context, in AdminCreditInput) (AdminCredit, error) {
	if in.Amount.Paise() <= 0 {
		return AdminCredit{}, fmt.Errorf("ledger: admin credit must be a positive amount")
	}
	booking, err := sqlcgen.New(service.pool).GetBooking(ctx, in.BookingID)
	if errors.Is(err, pgx.ErrNoRows) {
		return AdminCredit{}, ErrBookingNotFound
	}
	if err != nil {
		return AdminCredit{}, fmt.Errorf("reading booking: %w", err)
	}

	var credit AdminCredit
	err = storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		inTx := sqlcgen.New(tx)
		orderID := booking.OrderID
		customerID := booking.CustomerID
		recordedAt, err := inTx.InsertAdminCredit(ctx, sqlcgen.InsertAdminCreditParams{
			ID:          in.CreditID,
			AmountPaise: in.Amount,
			OrderID:     &orderID,
			CustomerID:  &customerID,
			Memo:        in.Memo,
		})
		if err != nil {
			return fmt.Errorf("recording credit: %w", err)
		}
		credit = AdminCredit{CreditID: in.CreditID, RecordedAt: recordedAt.Time}

		adminID := in.AdminID
		detail := map[string]string{"credit_id": in.CreditID.String(), "amount_paise": in.Amount.String()}
		for field, value := range in.AuditDetail {
			detail[field] = value
		}
		if err := audit.Record(ctx, tx, audit.Entry{
			ActorUserID: &adminID,
			Action:      in.AuditAction,
			EntityType:  "booking",
			EntityID:    in.BookingID,
			After:       detail,
		}); err != nil {
			return fmt.Errorf("writing audit trail: %w", err)
		}

		if in.ReplayKeyID != nil && in.ReplayReceipt != nil {
			if err := audit.Record(ctx, tx, audit.Entry{
				ActorUserID: &adminID,
				Action:      in.AuditAction,
				EntityType:  "admin_action_key",
				EntityID:    *in.ReplayKeyID,
				After:       in.ReplayReceipt,
			}); err != nil {
				return fmt.Errorf("writing replay record: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return AdminCredit{}, err
	}
	return credit, nil
}

// ReverseLatestCreditForBooking offsets the newest not-yet-reversed credit on the booking's
// order — the money half of an undo-cancel. reversed=false (with a nil error) means there
// was no credit to reverse, which is not a failure.
func (service *Service) ReverseLatestCreditForBooking(ctx context.Context, bookingID, adminID uuid.UUID, memo string) (reversed bool, err error) {
	queries := sqlcgen.New(service.pool)
	booking, err := queries.GetBooking(ctx, bookingID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, ErrBookingNotFound
	}
	if err != nil {
		return false, fmt.Errorf("reading booking: %w", err)
	}
	credit, err := queries.AdminLatestUnreversedCreditForOrder(ctx, &booking.OrderID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("reading credit to reverse: %w", err)
	}

	err = storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		orderID := booking.OrderID
		creditID := credit.ID
		if _, err := sqlcgen.New(tx).InsertCreditReversal(ctx, sqlcgen.InsertCreditReversalParams{
			AmountPaise:     credit.AmountPaise,
			OrderID:         &orderID,
			CustomerID:      credit.CustomerID,
			Memo:            memo,
			ReversesEntryID: &creditID,
		}); err != nil {
			return fmt.Errorf("recording reversal: %w", err)
		}
		actor := adminID
		return audit.Record(ctx, tx, audit.Entry{
			ActorUserID: &actor,
			Action:      "REFUND_REVERSED",
			EntityType:  "booking",
			EntityID:    bookingID,
			After: map[string]string{
				"reversed_credit_id": credit.ID.String(),
				"amount_paise":       credit.AmountPaise.String(),
			},
		})
	})
	if err != nil {
		return false, err
	}
	return true, nil
}

// CreditPosition is what has been credited (and taken back) against an order.
type CreditPosition struct {
	Issued   money.Money
	Redeemed money.Money
}

// Outstanding is the net credit still standing.
func (position CreditPosition) Outstanding() money.Money {
	return money.FromPaise(position.Issued.Paise() - position.Redeemed.Paise())
}

// CreditPositionForOrder reads the whole credit history of an order — the refund screen's
// alreadyRefunded figure.
func (service *Service) CreditPositionForOrder(ctx context.Context, orderID uuid.UUID) (CreditPosition, error) {
	row, err := sqlcgen.New(service.pool).AdminCreditTotalsForOrder(ctx, &orderID)
	if err != nil {
		return CreditPosition{}, fmt.Errorf("reading credit totals: %w", err)
	}
	return CreditPosition{
		Issued:   money.FromPaise(row.IssuedPaise),
		Redeemed: money.FromPaise(row.RedeemedPaise),
	}, nil
}
