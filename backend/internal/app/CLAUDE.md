# internal/app — CLAUDE.md

## Purpose
The ASSEMBLY layer. Holds the composition wiring that would otherwise bloat `cmd/api/main.go` — specifically, wiring every domain service onto the outbox dispatcher as an event consumer. It is the one place allowed broad cross-domain imports.

## Responsibilities
- `RegisterConsumers` — the single list of event reactions (auto-search, the alert engine, dual-OTP issuance, billing, credits, notifications, ratings).

## Owns
none.

## Allowed Dependencies
Many domain services: `identity`, `ledger`, `notifications`, `ops`, `verification`, plus `outbox`, `money`. It is explicitly EXEMPT from depguard `cores-must-not-import-consumers` (it is the assembly layer, not a core).

## Forbidden Dependencies
- Must NOT import `httpapi` (transport wires itself; assembly wires consumers).

## Contains
- `ConsumerDeps{Notifications, Ops, Verification, Ledger, Identity, Alert, FailedCredit, DevEchoOTP, Logger}`.
- `RegisterConsumers(dispatcher, deps)` — subscribes:
  - `SubscribeAll` → `outbox.LoggingHandler` (trace every event).
  - `SubscribeAll` → `Notifications.Notify` for `booking` aggregates (customer voice).
  - `booking.confirmed` → `Ops.StartSearch` (auto-search into the assignment queue).
  - `booking.escalated` → `Alert.RecordBookingEscalation` (the alert engine: one CRITICAL alert per escalation; idempotent on the outbox event id).
  - `technician.arrived` → issue START OTP; `booking.awaiting_completion` → issue COMPLETION OTP (via `issueOTP`).
  - `booking.completed` → `Ledger.RecordCompletion` (decodes `payment_method` from the payload).
  - `booking.failed` → `Ledger.IssueFailureCredit` (goodwill credit).
  - `review.submitted` → `Identity.RecomputeTechnicianRating` (decodes `technician_id`).
- `issueOTP(deps, purpose)` — idempotent handler: `Verification.IssueOTP` (no-op if a live code exists), dev-echoes the code when `DevEchoOTP`, then `Notifications.SendJobCode`.

## Examples
```go
dispatcher := outbox.NewDispatcher()
app.RegisterConsumers(dispatcher, app.ConsumerDeps{
    Notifications: notifSvc, Ops: opsSvc, Verification: verSvc,
    Ledger: ledgerSvc, Identity: identitySvc,
    FailedCredit: cfg.FailedCredit(), DevEchoOTP: cfg.DevEchoOTP, Logger: log,
})
worker := outbox.NewWorker(pool, dispatcher)
```

## Best Practices
- Add a new event reaction HERE, once — keep `cmd/api` a thin composition root.
- Every handler registered here must be idempotent (at-least-once outbox delivery).
- Match the event-type string EXACTLY to what the publisher writes (a typo silently drops the reaction — the review's motivation for a typed `topics` registry).

## Common Mistakes
- Importing `httpapi` (forbidden) or leaking transport concerns into assembly.
- Writing a consumer that isn't idempotent, causing double effects on redelivery.
- Putting business logic in the handler closure instead of delegating to the owning service.
