# internal/gateway — CLAUDE.md

## Purpose
The idempotent payment-gateway webhook inbox. Dedupes deliveries, durably persists the raw verified event, and tracks whether it has been applied — the record the webhook handler and the parked-event replay sweep both work from.

## Responsibilities
- Short-circuit an already-applied delivery (`AlreadyProcessed`).
- Record a verified event as RECEIVED, idempotently (`Record`).
- Mark an event applied (`MarkProcessed`).
- Replay "parked" events (accepted but not yet applied — the webhook beat its payment row) via `ReplayParked`.

## Owns
`payment_gateway_events` (dedupe key: `gateway_event_id` UNIQUE).

## Allowed Dependencies
`storage/sqlcgen`, `pgx`/`pgxpool`, stdlib.

## Forbidden Dependencies
- No `httpapi`, no `ledger`. It stays free of a ledger import by taking a `CaptureFunc` callback (which the caller binds to `ledger.CaptureUPIPayment`).

## Contains
- `Store` — `NewStore(pool)`.
- `Event{Provider, EventType, GatewayEventID, Reference, ProviderRef, Payload}` — one delivered, signature-verified webhook (`Provider` defaults to `"razorpay"`).
- Status consts `statusReceived = "RECEIVED"`, `statusProcessed = "PROCESSED"` (unexported; review recommends promoting to a typed enum + drift test — Phase 6 gap; FAILED also exists in the DB CHECK).
- `AlreadyProcessed(ctx, gatewayEventID)` — absent row counts as not-processed.
- `Record(ctx, event)` — inserts as RECEIVED; duplicate `gateway_event_id` is a no-op.
- `MarkProcessed(ctx, gatewayEventID)`.
- `CaptureFunc func(ctx, reference string, providerRef *string) error` — matches `ledger.CaptureUPIPayment`.
- `ReplayParked(ctx, olderThanMinutes, max, capture, log)` — re-drives capture (idempotent, no re-verify — signatures were checked at ingest) for `payment_link.paid` events, marks PROCESSED on success, leaves still-failing events parked. Returns count applied.

## Examples
```go
store := gateway.NewStore(pool)
// In the webhook handler (httpapi/razorpay_webhook.go):
if processed, _ := store.AlreadyProcessed(ctx, id); processed { return 200 }
store.Record(ctx, gateway.Event{EventType: ev, GatewayEventID: id, Reference: ref, Payload: raw})
// ... ledger.CaptureUPIPayment(...) ...
store.MarkProcessed(ctx, id)
// Background sweep:
store.ReplayParked(ctx, 5, 100, ledger.CaptureUPIPayment, log)
```

## Best Practices
- Verify the signature BEFORE recording (done in the transport handler); this package assumes the event is authentic.
- Record → apply → MarkProcessed; an event left RECEIVED is "parked" and will be retried — that is the designed race handling, not an error.
- Keep capture idempotent so a gateway retry (or a replay) is always safe.

## Common Mistakes
- Re-verifying signatures during replay (unnecessary — verified at ingest) or, worse, applying without recording.
- Treating a parked event as a failure and NAKing the webhook (would trigger a Razorpay retry-storm) — 200-ack and let the sweep replay it.
- Importing `ledger` directly instead of accepting a `CaptureFunc`.
