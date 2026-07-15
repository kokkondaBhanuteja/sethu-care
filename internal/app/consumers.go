// Package app holds composition wiring that would otherwise bloat cmd/api/main.go. It may
// import any domain module (it is the layer that assembles them); the depguard "cores must not
// import consumers" rule deliberately does not constrain it.
package app

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
	"github.com/kokkondaBhanuteja/sethu-care/internal/notifications"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ops"
	"github.com/kokkondaBhanuteja/sethu-care/internal/outbox"
	"github.com/kokkondaBhanuteja/sethu-care/internal/verification"
)

// ConsumerDeps is everything the outbox consumers need. Collecting it here keeps main.go's
// composition root small as the number of event consumers grows.
type ConsumerDeps struct {
	Notifications *notifications.Service
	Ops           *ops.Service
	Verification  *verification.Service
	Ledger        *ledger.Service
	Identity      *identity.Service
	FailedCredit  money.Money
	DevEchoOTP    bool
	Logger        *slog.Logger
}

// RegisterConsumers wires every outbox consumer onto the dispatcher. This is THE list of
// event reactions — auto-search, dual-OTP issuance, billing, credits, notifications, ratings —
// so adding one means adding it here, once, and main.go stays a thin composition root.
func RegisterConsumers(dispatcher *outbox.Dispatcher, deps ConsumerDeps) {
	// Log every event first, for an at-a-glance trace of the stream.
	dispatcher.SubscribeAll(outbox.LoggingHandler(deps.Logger))

	// NOTIFICATIONS: the customer-facing voice. It sees every booking event and sends a message
	// for the ones a customer should hear about; the rest it skips.
	dispatcher.SubscribeAll(func(ctx context.Context, event outbox.Event) error {
		if event.AggregateType != "booking" {
			return nil
		}
		return deps.Notifications.Notify(ctx, event.EventType, event.AggregateID)
	})

	// AUTO-SEARCH: a confirmed booking moves itself into SEARCHING (and thus the assignment
	// queue) without an admin poking it.
	dispatcher.Subscribe("booking.confirmed", func(ctx context.Context, event outbox.Event) error {
		return deps.Ops.StartSearch(ctx, event.AggregateID)
	})

	// DUAL OTP issuance: START code when the technician arrives, COMPLETION code when they say the
	// work is done. Verification happens interactively on the transition endpoint.
	dispatcher.Subscribe("technician.arrived", issueOTP(deps, verification.PurposeStart))
	dispatcher.Subscribe("booking.awaiting_completion", issueOTP(deps, verification.PurposeCompletion))

	// BILLING: a completed booking records its ledger entry (REVENUE or CASH_CUSTODY). The
	// payment method rides the event payload from the completion request.
	dispatcher.Subscribe("booking.completed", func(ctx context.Context, event outbox.Event) error {
		var payload struct {
			PaymentMethod string `json:"payment_method"`
		}
		if err := json.Unmarshal(event.Payload, &payload); err != nil {
			return fmt.Errorf("decoding booking.completed: %w", err)
		}
		return deps.Ledger.RecordCompletion(ctx, event.AggregateID, ledger.PaymentMethod(payload.PaymentMethod))
	})

	// CREDITS: a booking that FAILED (nobody could be found) gets a goodwill credit.
	dispatcher.Subscribe("booking.failed", func(ctx context.Context, event outbox.Event) error {
		return deps.Ledger.IssueFailureCredit(ctx, event.AggregateID, deps.FailedCredit)
	})

	// RATINGS: a submitted review updates the technician's rating — the signal the assignment
	// queue ranks by. Reviews publishes; Identity (which owns technicians) recomputes.
	dispatcher.Subscribe("review.submitted", func(ctx context.Context, event outbox.Event) error {
		var payload struct {
			TechnicianID uuid.UUID `json:"technician_id"`
		}
		if err := json.Unmarshal(event.Payload, &payload); err != nil {
			return fmt.Errorf("decoding review.submitted: %w", err)
		}
		return deps.Identity.RecomputeTechnicianRating(ctx, payload.TechnicianID)
	})
}

// issueOTP returns an outbox handler that issues the START or COMPLETION code for the booking the
// event names and texts it to the customer. Idempotent: a redelivered event finds the code
// already issued (issued=false) and neither re-issues nor re-sends. In dev it also echoes the
// code to the log for local testing without a real handset.
func issueOTP(deps ConsumerDeps, purpose verification.Purpose) outbox.Handler {
	return func(ctx context.Context, event outbox.Event) error {
		code, issued, err := deps.Verification.IssueOTP(ctx, event.AggregateID, purpose)
		if err != nil {
			return err
		}
		if !issued {
			return nil // a live code already exists — nothing to send
		}
		if deps.DevEchoOTP {
			deps.Logger.Info("DEV job otp issued", "booking_id", event.AggregateID, "purpose", purpose, "code", code)
		}
		return deps.Notifications.SendJobCode(ctx, event.AggregateID, purpose.String(), code)
	}
}
