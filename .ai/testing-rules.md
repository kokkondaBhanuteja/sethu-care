# Testing Rules

## Purpose
How this repo proves correctness — real Postgres, exhaustive enum/state coverage, and drift guards.
Grounded in review Phase 12/13 and `internal/schema`, `internal/storage/storagetest`.

## Rules
1. Test the database against **real PostGIS via testcontainers**, one per package — no mocks, no H2.
   Get a pool with `storagetest.NewPool(t, "../../db/migrations")`.
2. Run with `-race` (`make check` / `make test`); a full `go test -race ./...` takes a few minutes and
   is finite — don't wait forever for it.
3. Write **table-driven** tests for enums, permissions, and the state machine; exhaustively cover the
   `(state, action)` grid for the booking machine (169 combinations run in milliseconds).
4. Keep the **enum drift test** current: every persisted enum column appears in
   `internal/schema/drift_test.go`, asserting Go `AllX()` == the DB CHECK set. A new enum without an
   entry must fail here.
5. Keep the **OpenAPI contract drift** green: `make openapi` output is committed and CI-checked; a
   stale `api/openapi.yaml` fails the build.
6. Test security invariants explicitly — e.g. the JWT `alg=none`/RS256-confusion rejection lives in
   `internal/auth/jwt_test.go`; keep such adversarial cases when touching auth.
7. Add a test that every exported domain error maps to a non-500 (or is intentionally 500) in
   `classify()`, so a new error can't silently become a 500 (review Phase 9 recommendation).
8. A test file may import sibling domains to seed data (depguard exempts `*_test.go` from
   `cores-must-not-import-consumers` and `money-is-a-pure-leaf`).

## Examples
- Real-Postgres harness: `internal/storage/storagetest` used by `internal/schema/drift_test.go`.
- Exhaustive state-machine tests: `internal/booking/statemachine_test.go`, `constants_test.go`.
- Adversarial JWT tests: `internal/auth/jwt_test.go` (`alg=none` must be rejected).
- OTP invariants (hash-only storage, attempt cap): `internal/identity/service_test.go`.

## Anti-patterns
- Mocking the database instead of using testcontainers (hides SQLSTATE/constraint behaviour).
- Skipping the drift-test entry for a new enum.
- Committing a handler change without regenerating/committing `api/openapi.yaml`.
- Asserting on error strings instead of `errors.Is/As`.

## Checklist
- [ ] New DB behaviour covered by a testcontainers test.
- [ ] Tests pass under `-race`.
- [ ] New enum has a drift-test entry; new error has a `classify()` mapping test.
- [ ] `api/openapi.yaml` regenerated and committed when handlers changed.
