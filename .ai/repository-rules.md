# Repository Rules

## Purpose
Explain the deliberate absence of a repository-interface layer and the boundary rules that replace it.
Grounded in review Phase 2 and Phase 12.

## Rules
1. There is **no repository abstraction** — domain services call the generated
   `internal/storage/sqlcgen` directly. This is a deliberate sqlc trade-off; do NOT introduce
   `Repository` interfaces or a `BaseService` to "clean it up" (review Phase 8 forbids it).
2. **Only a package's own service may call `sqlcgen` for its tables.** Cross-table reads go through
   the owning service, never a direct query into another context's tables.
3. Every write to an aggregate goes through `storage.InTx`; construct queries with
   `sqlcgen.New(tx)` inside the closure so they enlist in the transaction.
4. Keep `sqlcgen` **generated and untouched** — regenerate with `make generate` after any change to
   `db/migrations` or `db/queries`; never hand-edit files under `internal/storage/sqlcgen`.
5. sqlc type overrides are authoritative (`sqlc.yaml`): every `*_paise` column is `money.Money`, every
   `uuid` is `google/uuid.UUID`. Don't defeat these by casting back to `int64`.
6. Where a service's query surface is large and a test seam helps, a **thin per-context data-access
   type** (e.g. a `bookingStore`) is acceptable — but only as a testability seam, not a full
   repository framework (review Phase 12 rec. 1).
7. SQLSTATE→domain-error translation happens in `internal/storage` and the owning service, never in
   transport (see `database-rules.md`).

## Examples
- Service calling generated queries in a tx: `internal/booking/service.go`
  (`queries := sqlcgen.New(tx)` then `queries.InsertBookingEvent(...)`, `InsertOutboxEvent(...)`).
- Overrides that keep types safe end-to-end: `sqlc.yaml` (`*.*_paise → money.Money`, `uuid → uuid.UUID`).
- Audit writing through the caller's tx: `internal/audit/audit.go` `Record(ctx, tx, entry)`.

## Anti-patterns
- Adding a generic `Repository[T]`/`BaseRepository` — fights sqlc and per-context ownership.
- Querying another context's tables directly to avoid calling its service.
- Editing `internal/storage/sqlcgen/*` by hand (it will be overwritten and drift-guarded).
- Reading a `*_paise` column as a bare `int64` and doing float math on it.

## Checklist
- [ ] No new repository interface / base-service abstraction.
- [ ] Only the owning service touches `sqlcgen` for its tables.
- [ ] All writes go through `storage.InTx` with `sqlcgen.New(tx)`.
- [ ] `make generate` run after schema/query changes; no hand edits under `sqlcgen`.
