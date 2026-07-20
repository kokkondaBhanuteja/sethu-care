# Service Rules

## Purpose
How domain services are built so they stay the single home of business logic. Grounded in review
Phase 13 ("Services") and the booking/ledger implementations.

## Rules
1. Construct with `NewService(pool *pgxpool.Pool, opts ...Option)` and **functional options**; the
   constructor sets required deps, options add optional ones (`WithFlow(...)`).
2. **One aggregate per service.** A service owns exactly its tables and is the only writer of them
   (`booking.Service` owns `bookings`; `ledger.Service` owns `ledger_entries`/`payments`).
3. Put **business validation and HTTP-status selection in the service**, not transport — return a
   typed domain error (`ForbiddenError` → 403, `IllegalTransitionError` → 422, `ConflictError` → 409)
   or a sentinel; the handler only maps it via `classify()`.
4. Every method takes `ctx` first. Wrap all writes to the aggregate in one `storage.InTx` so the
   aggregate row, its `booking_events`/audit row, and any `outbox` row commit atomically.
5. Enforce **role authorization then ownership inside the transaction, before legality**, so an
   unauthorized caller can't probe what's legal (`CanPerform` role gate, then the booking-row
   ownership check inside `Apply`).
6. Guard concurrent mutation with **optimistic CAS** (`version = version+1 WHERE version = $expected`);
   zero rows affected ⇒ return `ConflictError` (409). Don't lock optimistically-guarded rows with
   `SELECT … FOR UPDATE` instead.
7. Take cross-context data by calling the **owning** service, never by reading its tables. `ops.New`
   takes a `*booking.Service`; `ledger` consumes `booking` types.
8. Degrade permissively on the flow/Redis layer — it is a smoother, the database is the guard
   (`WithFlow` is optional; absence just removes locking).

## Examples
- Constructor + option: `internal/booking/service.go` `NewService`, `WithFlow`.
- Atomic transition with CAS + events + audit + outbox: `internal/booking/service.go` `Apply`
  (`storage.InTx` → re-read → authorize → pure `Apply` → CAS → `InsertBookingEvent` →
  `audit.Record` → conditional `InsertOutboxEvent`).
- Status selection in the service: `booking.ForbiddenError`, `ConflictError`, `ScheduleConflictError`.

## Anti-patterns
- A service writing another context's tables (breaks single-writer ownership).
- Doing validation or choosing a status code in the handler.
- A constructor with a long positional parameter list instead of functional options.
- Splitting a state change and its outbox/audit rows across two transactions (loses atomicity).

## Checklist
- [ ] `NewService(pool, ...Option)` shape; optional deps via `With…` options.
- [ ] Service owns exactly one aggregate and is its sole writer.
- [ ] All mutations wrapped in `storage.InTx`; CAS guards concurrent writes.
- [ ] Role + ownership checked inside the tx before legality.
- [ ] Errors returned are typed/sentinel with the right status; handler only calls `classify()`.
