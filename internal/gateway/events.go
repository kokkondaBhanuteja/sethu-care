// Package gateway is the idempotent payment-gateway webhook inbox (payment_gateway_events). It
// dedupes deliveries, persists the raw verified event, and tracks whether it has been applied — the
// durable record the webhook handler and the parked-event replay sweep both work from.
package gateway

import (
	"context"
	"errors"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

const (
	statusReceived  = "RECEIVED"
	statusProcessed = "PROCESSED"
)

// Store wraps the inbox table.
type Store struct{ pool *pgxpool.Pool }

func NewStore(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// Event is one delivered, signature-verified webhook.
type Event struct {
	Provider       string // defaults to "razorpay"
	EventType      string
	GatewayEventID string // the provider's own event id — the dedupe key
	Reference      string // our payment reference, when resolvable
	ProviderRef    string // the provider's payment entity id
	Payload        []byte // the raw verified body
}

// AlreadyProcessed reports whether this exact delivery has already been applied, so a gateway retry
// short-circuits instead of re-running capture. Absent (never seen) counts as not-processed.
func (store *Store) AlreadyProcessed(ctx context.Context, gatewayEventID string) (bool, error) {
	status, err := sqlcgen.New(store.pool).GetGatewayEventStatus(ctx, gatewayEventID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return status == statusProcessed, nil
}

// Record persists the raw event as RECEIVED; a duplicate gateway_event_id is a no-op so the inbox
// stays idempotent under retries and concurrent deliveries.
func (store *Store) Record(ctx context.Context, event Event) error {
	provider := event.Provider
	if provider == "" {
		provider = "razorpay"
	}
	return sqlcgen.New(store.pool).InsertGatewayEvent(ctx, sqlcgen.InsertGatewayEventParams{
		Provider:       provider,
		EventType:      event.EventType,
		GatewayEventID: event.GatewayEventID,
		Reference:      event.Reference,
		ProviderRef:    event.ProviderRef,
		Payload:        event.Payload,
	})
}

// MarkProcessed flags the event applied. An event left RECEIVED is "parked" — accepted but not yet
// applied (the payment row wasn't visible) — and the replay sweep will retry it.
func (store *Store) MarkProcessed(ctx context.Context, gatewayEventID string) error {
	return sqlcgen.New(store.pool).MarkGatewayEventProcessed(ctx, gatewayEventID)
}

// CaptureFunc applies a paid payment link to its collection. It matches ledger.CaptureUPIPayment;
// passed as a func so this package stays free of a ledger import.
type CaptureFunc func(ctx context.Context, reference string, providerRef *string) error

// ReplayParked retries events that were accepted but never applied — the webhook that beat its
// payment row. Signatures were verified at ingest, so there is no re-verify: it just re-drives
// capture (idempotent) and marks the event PROCESSED on success. An event that still fails is left
// parked for the next sweep. Returns the number applied this pass.
func (store *Store) ReplayParked(ctx context.Context, olderThanMinutes, max int, capture CaptureFunc, log *slog.Logger) (int, error) {
	rows, err := sqlcgen.New(store.pool).ListParkedGatewayEvents(ctx, sqlcgen.ListParkedGatewayEventsParams{
		OlderThanMinutes: int32(olderThanMinutes),
		MaxRows:          int32(max),
	})
	if err != nil {
		return 0, err
	}
	applied := 0
	for _, row := range rows {
		if row.EventType == "payment_link.paid" && row.Reference != "" {
			providerRef := row.ProviderRef
			if err := capture(ctx, row.Reference, &providerRef); err != nil {
				// Still unresolved (payment row absent, or a transient error). Leave it parked.
				log.Warn("parked gateway event still failing", "id", row.GatewayEventID, "reference", row.Reference, "err", err)
				continue
			}
		}
		if err := store.MarkProcessed(ctx, row.GatewayEventID); err != nil {
			log.Error("marking replayed event processed", "id", row.GatewayEventID, "err", err)
			continue
		}
		applied++
	}
	return applied, nil
}
