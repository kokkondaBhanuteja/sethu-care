# internal/rescue — CLAUDE.md

## Purpose
The write side of the admin console's booking rescue (phase 2): manual-assign support, emergency cancel, redispatch, admin-verified manual completion, refund, and the compensating undos. Every action screen's `*-context` read is served here too — the console never computes a policy amount, cap or lock for itself.

## Responsibilities
- Context reads: `AssignContext` (candidates ranked skill-match → PostGIS distance → acceptance → rating, from real technician data), `CancelContext` (policy refund = paid − credits standing; fee always 0), `RedispatchContext` (rounds from `booking_events` meta, caps, next-radius suggestion), `ManualCompletionContext` (30-min lock remainder, evidence, per-admin/per-technician frequency counters), `RefundContext` (refundable, ₹500 goodwill cap, per-admin hourly rate-limit standing).
- Mutations: `Cancel`, `UndoCancel`, `UndoAssign`, `Redispatch` (RESUME with parameters recorded on the event), `ManualComplete` (lock → `TooEarlyError` 409; gates → `EvidenceError` 422; then VERIFY_COMPLETION with the admin-verified marker and `PaymentMethod=UPI`, so the EXISTING completion path opens collection), `Refund` (immediate CREDIT_ISSUED; **no undo**).
- Idempotency: every mutation replays its `Idempotency-Key` via the audit replay store; the refund's replay record commits **in the same transaction** as its credit, so a retry can never move money twice. Transition replays rely on the version CAS to fail safely in the rare unsaved-key crash window.
- Undo semantics: a real, audited ESCALATE compensation (assign 30s, cancel 10s — the windows are time guards HERE; the machine only states legality). `UndoCancel` also reverses the cancel's credit (offsetting `CREDIT_REDEEMED`) and reports `RefundReversed`/failure honestly.

## Owns
Nothing. Like `ops` it is a command/read surface: state through `booking.Apply` (pinned with `ExpectedVersion`, diagnostics in `Meta`), money through `ledger`, trail/replay through `audit`, plus read-only cross-module SQL (`AdminAssignCandidates`, redispatch events, completion counters, work-photo ids — in `db/queries/booking.sql`).

## Allowed Dependencies
`booking`, `ledger`, `audit`, `money`, `storage/sqlcgen`, stdlib, `pgx`, `google/uuid`.

## Forbidden Dependencies
`httpapi`/`huma`/`config`. Never write another context's tables — command the owning service.

## Contains
- `service.go` — `Service`, `New(pool, bookings, ledger, audit)`; policy constants (`GoodwillCapPaise` ₹500, `IncentiveCapPaise` ₹750, `RefundsAllowedPerHour` 10, undo windows, 30-min lock); `Radius` steps (base 10km / +50% / +100% / city-wide 30km); `Subject` + `loadRecord` (AdminDetailByID ⊕ PaymentFacts).
- `contexts.go` — the five context reads and their view types; honest zeros where no engine exists (declines, call log, provider payout).
- `actions.go` — the six mutations, receipts (JSON-tagged: they are the stored replay records), operation-id constants.
- `errors.go` — the designed failures: `StaleVersionError`/`UndoWindowClosedError`/`NotUndoableError`/`TerminalStateError`/`TooEarlyError` (→409), `NotEligibleError`/`EvidenceError`/`CapExceededError`/`ValidationError` (→422), `RateLimitedError` (→429). Mapped in `classify()`; bodies built in `httpapi.adminActionError`.

## Best Practices
- Version check FIRST (a stale read answers with the current version), then state, then policy gates, then the machine.
- Record honest zeros, never invented data: no offer engine → 0 declines; no call log → empty attempts; salaried technicians → 0 payout.
- New diagnostics ride the transition's `booking_events` meta (`redispatch`, `undo`, `manual_completion`, `cancel` objects) — never a parallel state write.

## Common Mistakes
- Writing bookings/ledger tables directly instead of commanding the owning service.
- Enforcing an undo window in the state machine (it is a time guard here, like the 60s customer-cancel guard).
- Returning a rate-limit or cap failure without its typed error (the console renders the declared body).
