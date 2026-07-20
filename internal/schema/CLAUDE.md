# internal/schema — CLAUDE.md

## Purpose
TEST-ONLY. The guard that keeps Go's enum constants and Postgres's CHECK constraints from drifting apart. Our enum policy is "TEXT column + CHECK constraint, Go constants as the source of truth"; the classic failure of that pattern is silent divergence (a constant added without a migration, or vice versa). This package reads the CHECK constraints straight out of `pg_constraint` on a REAL PostGIS container and asserts each lists exactly the values its Go enum declares.

## Responsibilities
- Assert `Go AllX() == DB CHECK value set` for every enum-backed column.
- Pin that `bookings.state` deliberately has NO CHECK (the state machine is the sole authority).

## Owns
none.

## Allowed Dependencies
Every enum package it verifies (`catalog`, `identity`, `ledger`, `order`, `verification`), `storage/storagetest`, `pgx`, stdlib testing. Package is `schema_test`.

## Forbidden Dependencies
- **Production code must NOT import `internal/schema`.** It is test-only (Phase 4 recommends an explicit depguard rule forbidding any import of it).

## Contains
- `drift_test.go`:
  - `TestEveryEnumColumnMatchesItsGoConstants` — table of `{table, column, want}` cases (`users.role`, `services.assignment_mode`, `question_defs.kind`, `orders.status`, `ledger_entries.kind`/`method`, `payments.status`, `otp_challenges.purpose`, `work_photos.kind`), each comparing the DB CHECK set to `toStrings(pkg.AllX())`.
  - `TestBookingStateDeliberatelyHasNoCheckConstraint` — fails if `bookings.state` ever acquires a CHECK.
  - Helpers: `checkConstraintValues` (parses `pg_get_constraintdef`, picks the `ANY(ARRAY[...])` value list), `assertSameSet` (both directions, with actionable messages), `toStrings[T ~string]`.

## Examples
Add a case whenever a new enum-backed column ships:
```go
{"notification_log", "channel", toStrings(notifications.AllChannels())},
```
NOTE: `notifications.Channel`, `audit.ActorKind`, and the `gateway` event status are NOT covered yet — the review flags them as the open drift-test gaps (Phase 6). Adding them (with `Valid()`/`Parse()` + a migration) closes the holes.

## Best Practices
- Add the constant, the DB CHECK migration, AND the drift-test case in the SAME PR — that's the whole point.
- Keep this package test-only; never let production code import it.
- Run against the real container harness (`storagetest.NewPool`) — the test reads what Postgres actually stored, not what we wrote.

## Common Mistakes
- Adding an enum value without a migration (build goes red here) — or a migration without the constant.
- "Helpfully" adding a CHECK to `bookings.state` — deliberately omitted; the state machine enforces more than a CHECK could.
- Importing `schema` from non-test code.
