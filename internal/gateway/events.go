// Package gateway is the idempotent payment-gateway webhook inbox (payment_gateway_events). It
// dedupes deliveries, persists the raw verified event, and tracks whether it has been applied — the
// durable record the webhook handler and the parked-event replay sweep both work from.
package gateway

import (
	"context"
	"errors"

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
