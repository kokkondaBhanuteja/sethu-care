# Enum Rules

## Purpose
Pin the one enum pattern this repo uses so Go constants and Postgres CHECK constraints never drift.
Grounded in review Phase 6 and `internal/booking/state.go`, `internal/ledger/enums.go`,
`internal/schema/drift_test.go`.

## Rules
1. Any value that is **persisted, serialized, or crosses the API/DB boundary** is a
   `type X string` with a **closed `const` block** — never `iota`, never `type X int` (ordinals are
   fragile across reordering; strings are stable and self-describing).
2. Every such enum ships the **full pattern**:
   - `AllX() []X` — the closed set (the DB CHECK is generated from this).
   - `Valid() bool` via an exhaustive `switch` (watched by the `exhaustive` linter).
   - `ParseX(raw string) (X, error)` — the boundary constructor returning a package-prefixed error.
   - `String() string`.
3. Values are **UPPER_SNAKE** (`CASH_CUSTODY`, `EN_ROUTE`). The lone lowercase enum, `audit.ActorKind`
   (`user/system/gateway`), is a known inconsistency to fix (change Go + DB CHECK together).
4. Store as **TEXT + CHECK**; add the enum to `internal/schema/drift_test.go` so `AllX()` is asserted
   equal to the DB CHECK set. **Add the Go constant, the migration, and the drift-test entry in the
   same PR.**
5. Keep the `Valid()`/`CanPerform()` switch **exhaustive** — the linter runs with
   `default-signifies-exhaustive: false`, so adding a 14th value fails the build until every switch
   handles it. Never add a `default:` to quiet it.
6. Fill the current gaps to match the pattern: `notifications.Channel` (SMS/PUSH) and
   `audit.ActorKind` lack `Valid()`/`ParseX()` and are absent from the drift test; `gateway` status
   (`RECEIVED/PROCESSED/FAILED`) are private consts — promote all three to the full pattern.
7. `bookings.state` is deliberately the one enum column **without** a DB CHECK — the state machine is
   its authority — but it is still pinned by a test. Don't add a CHECK there.

## Examples
- Full pattern: `internal/ledger/enums.go` (`EntryKind` + `AllEntryKinds`/`Valid`/`ParseEntryKind`).
- State enum + exhaustive `Valid()`: `internal/booking/state.go`.
- Drift guard reading `pg_constraint`: `internal/schema/drift_test.go`.

## Anti-patterns
- `iota`/`type X int` for a persisted value.
- Adding a constant without the matching migration + drift-test entry (silent divergence).
- lowercase or mixed-case enum values (except the tracked `ActorKind` fix).
- `default:` in an enum switch to satisfy the linter.

## Checklist
- [ ] New enum is `type X string` + closed const block, UPPER_SNAKE values.
- [ ] `AllX()`, `Valid()` (exhaustive), `ParseX()`, `String()` all present.
- [ ] DB column is TEXT + CHECK; drift-test entry added in the same PR.
- [ ] `make generate` + drift test pass.
