# internal/outbox — CLAUDE.md

## Purpose
The transactional-outbox worker. The publisher (booking.Service, etc.) writes an event into the `outbox` table atomically with its state change; this package guarantees that event is eventually DELIVERED to subscribers.

## Responsibilities
- Register subscribers by event type (`Subscribe`) or for all events (`SubscribeAll`).
- Poll `outbox` in batches using `FOR UPDATE SKIP LOCKED`, dispatch, and mark rows published (or record failure for retry).
- Run a long-lived worker loop that drains fully each tick and stops cleanly on ctx cancel.

## Owns
`outbox` table.

## Allowed Dependencies
`storage` (+`sqlcgen`), `pgx`/`pgxpool`, `google/uuid`, stdlib.

## Forbidden Dependencies
- No domain service. Dispatch is by string topic (`EventType`), so the worker never imports a publisher or consumer. (Review recommends a typed `topics` registry to remove the bare-string coupling — Phase 6.)
- No `httpapi`, no `config`.

## Contains
- `Event{ID, AggregateType, AggregateID, EventType, Payload, Attempts}` — one outbox row.
- `Handler func(context.Context, Event) error` — a func type, not an interface; returning an error leaves the event unpublished for retry.
- `Dispatcher` — `NewDispatcher()`, `Subscribe(eventType, handler)`, `SubscribeAll(handler)`; `dispatch` runs all-plus-typed handlers and `errors.Join`s failures. Safe for concurrent use (RWMutex).
- `Worker` — `NewWorker(pool, dispatcher, opts...)` with `WithInterval`, `WithBatchSize` (default 100), `WithLogger`. `Poll(ctx)` runs one batch in ONE tx (`ClaimUnpublishedOutbox` = SKIP LOCKED), dispatches each row, marks published or records failure (does NOT roll back the batch on a handler failure). `Run(ctx)` tickers + `drain`s until short batch. `LoggingHandler(log)`.

## Examples
```go
dispatcher := outbox.NewDispatcher()
dispatcher.SubscribeAll(outbox.LoggingHandler(log))
dispatcher.Subscribe("booking.completed", func(ctx context.Context, event outbox.Event) error {
    return ledger.RecordCompletion(ctx, event.AggregateID, method) // MUST be idempotent
})
worker := outbox.NewWorker(pool, dispatcher, outbox.WithInterval(time.Second))
go worker.Run(ctx)
```
(Actual consumer wiring lives in `internal/app`.)

## Best Practices
- Delivery is AT-LEAST-ONCE by contract: EVERY handler must be idempotent (a redelivered event must be harmless).
- A handler that fails should return an error (row stays unpublished, retried next poll) — don't swallow it.
- Match event-type strings EXACTLY between publisher and subscriber; a typo silently drops the event.

## Common Mistakes
- Writing a non-idempotent consumer and getting double effects on redelivery.
- Returning an error from `Poll`'s per-row loop for a handler failure (would roll back the whole batch and lose sibling successes) — the code records the failure and moves on; keep that shape.
- Assuming ordered or exactly-once delivery — neither is guaranteed.
