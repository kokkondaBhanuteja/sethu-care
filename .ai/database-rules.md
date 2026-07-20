# Database Rules

## Purpose
The database is a co-enforcer of invariants, not a dumb store. These rules keep Go and Postgres in
agreement. Grounded in review Phase 12 and `db/`, `internal/storage`.

## Rules
1. All writes to an aggregate run inside one `storage.InTx` (recover-and-rollback built in). A state
   change plus its `booking_events`/`outbox` rows commit together or not at all.
2. Guard mutable aggregates with **optimistic locking**: a `version BIGINT` and a CAS update
   (`… WHERE version = $expected`); zero rows ⇒ `ConflictError` (409).
3. Persisted enums are **TEXT + CHECK**, with Go constants as the source of truth and a drift test
   (`internal/schema/drift_test.go`) asserting `AllX()` == the DB CHECK set. Add both sides in the
   same PR (see `enum-rules.md`).
4. Make ledgers/event logs **append-only by trigger, not convention**: `forbid_mutation()` rejects
   UPDATE/DELETE on `booking_events`, `ledger_entries`, `notification_log`. Correct with offsetting
   rows, never edits.
5. Enforce idempotency with **unique indexes** (`payments.booking_id`, `reviews.booking_id`,
   `notification_log` partial-unique, `payment_gateway_events.gateway_event_id`) plus service-level
   guards.
6. Keep cross-row invariants **in the DB**: the `bookings_no_double_book` EXCLUDE (btree_gist),
   money-level CHECKs, and the composite FK pinning a technician's user to `role=TECHNICIAN`.
7. Translate SQLSTATE to domain errors only in `internal/storage`/the owning service, never leaking a
   pgx error to transport. Codes handled: 23503 (FK), 23505 (unique), 23514 (check), 23P01 (exclude).
8. Use the outbox work-queue pattern `FOR UPDATE SKIP LOCKED` for the dispatcher; one
   `db/queries/<context>.sql` per bounded context with PascalCase verb-first query names.
9. After any `db/migrations` or `db/queries` change run `make generate`; tests run against real
   PostGIS via testcontainers — no mocks.

## Examples
- Transaction helper: `internal/storage/db.go` `InTx`.
- CAS + append-only event + double-book EXCLUDE: `internal/booking/service.go` `Apply`
  (`ScheduleConflictError` on 23P01, `ConflictError` on zero rows).
- SQLSTATE mapping: `internal/storage/errors.go` (`IsSQLState`, the four constants).
- SKIP LOCKED claim: `db/queries/outbox.sql`.
- Drift guard: `internal/schema/drift_test.go` reads `pg_constraint`.

## Anti-patterns
- UPDATE/DELETE on an append-only table (the trigger rejects it; write an offsetting row).
- Enforcing double-book/idempotency only in Go without the DB constraint backing it.
- Letting a pgx `*PgError` reach transport as a 500.
- Adding an enum value or migration without updating the other side + drift test.

## Checklist
- [ ] All aggregate writes in `storage.InTx`; version CAS where mutable.
- [ ] New persisted enum has TEXT+CHECK + Go `AllX()`/`Valid()` + drift-test entry.
- [ ] Idempotency backed by a unique index, not just a service check.
- [ ] SQLSTATE handled in storage/service, not leaked.
- [ ] `make generate` run; migrations + queries in sync.
