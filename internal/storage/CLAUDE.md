# internal/storage — CLAUDE.md

## Purpose
KERNEL / INFRA. Owns the Postgres connection pool and the transaction helper, and translates raw SQLSTATE codes into a form services can classify. This is infrastructure, NOT a domain module — the generated `sqlcgen` beneath it is the data-access layer, owned by nobody in particular.

## Responsibilities
- Open a `pgxpool.Pool` and register the `google/uuid` codec on every connection.
- Provide `InTx` — the one transaction boundary used by every aggregate write.
- Provide `IsSQLState` + the SQLSTATE constants services map to domain errors.
- Provide a testcontainers PostGIS harness for tests (`storagetest/`).

## Owns
none (owns the *pool*, not any table).

## Allowed Dependencies
`pgx`/`pgxpool`, `pgconn`, `pgx-google-uuid`, `sqlcgen`, stdlib.

## Forbidden Dependencies
- Must NOT import any domain module or `config` (Phase 4: `storage`/`sqlcgen` → any domain or config is forbidden and holds). Config is passed in as a DSN string.
- `sqlcgen/` is GENERATED — never hand-edit (regen via `sqlc`).

## Contains
- `db.go` — `NewPool(ctx, dsn)`: parses DSN, sets `AfterConnect` to `pgxuuid.Register` (pgx doesn't natively know google/uuid), pings. `InTx(ctx, pool, fn func(pgx.Tx) error)`: begin → run fn → commit; a `defer`/`recover` rolls back and re-panics on panic, rolls back on error (wrapping a rollback failure). `isTxClosed` guards double-rollback.
- `errors.go` — `IsSQLState(err, code)` via `errors.As` on `*pgconn.PgError` (walks the wrapped chain). Consts: `SQLStateForeignKeyViolation=23503`, `SQLStateUniqueViolation=23505`, `SQLStateCheckViolation=23514`, `SQLStateExclusionViolation=23P01`.
- `storagetest/` — `NewPool(t, migrationsDir)` spins a real PostGIS container (no mocks, no H2).
- `sqlcgen/` — GENERATED type-safe queries/models; maps `*_paise → money.Money`, `uuid → google/uuid` via `sqlc.yaml` overrides.

## Examples
```go
err := storage.InTx(ctx, pool, func(tx pgx.Tx) error {
    queries := sqlcgen.New(tx)
    if _, err := queries.SomeWrite(ctx, params); err != nil {
        if storage.IsSQLState(err, storage.SQLStateUniqueViolation) {
            return domain.ErrAlreadyExists // translate before it reaches transport
        }
        return err
    }
    return nil // commit; any returned error rolls back
})
```

## Best Practices
- Every aggregate write goes through `InTx`; a state change and its `booking_events`/`outbox`/`audit` rows commit together or not at all.
- Translate SQLSTATE into a domain error INSIDE the service — a raw pg error must never leak past `storage` (it would become a 500).
- Tests use `storagetest` against real PostGIS, never mocks.

## Common Mistakes
- Editing `sqlcgen/` by hand instead of changing `db/queries/*.sql` and regenerating.
- Importing a domain type here to "help" — it inverts the dependency direction.
- Doing DB work outside `InTx` and losing atomicity between the write and its outbox/audit rows.
