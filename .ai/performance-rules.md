# Performance Rules

## Purpose
The concurrency, work-queue, and scaling patterns that keep the backend correct under load without
premature optimization. Grounded in review Phase 12/13 and `internal/flow`, `internal/outbox`,
`internal/storage`.

## Rules
1. Treat the **Redis flow layer as a smoother, not a guard** — locks, slot holds, rate limiting, and
   idempotency caching **degrade permissively**: if Redis is absent or errors, the operation still
   proceeds because the **database is the real guard** (unique indexes, EXCLUDE, CAS).
2. Drain the outbox with the Postgres work-queue idiom **`FOR UPDATE SKIP LOCKED`** so multiple
   workers never process the same row and don't block each other (`db/queries/outbox.sql`).
3. Make every outbox consumer **idempotent** — delivery is at-least-once; a redelivered event must be
   a no-op (backed by unique indexes / existence guards, not just in-memory checks).
4. Use the shared **`pgxpool`** via `storage.NewPool`; keep transactions short (one `storage.InTx`
   scope) so connections return to the pool quickly; never hold a tx across network I/O.
5. Serialize hot contended paths through the flow layer where available (`WithFlow` makes `ASSIGN`
   serialise per technician, cutting contention on the no-double-book EXCLUDE) — but correctness must
   not depend on it.
6. Put **context timeouts** on the HTTP server (read/write/idle/header) and honour `ctx` cancellation
   in every service method and background loop (`select` on `ctx.Done()`).
7. **Pagination is currently missing** — list endpoints return full slices. Adopt **keyset (cursor)
   pagination** for `/ops/*` queues and payments before those tables grow; don't add offset pagination.
8. Rely on the schema's purposeful partial/GiST indexes; run an `EXPLAIN`-based check on the ops
   ranking and reconciliation views as data grows (review Phase 12 rec. 4) before adding new ones.

## Examples
- Permissive degrade: `internal/httpapi/ratelimit.go` (fail open on Redis error);
  `internal/httpapi/bookings.go` `create` (idempotency degrades cleanly when `flow == nil`).
- SKIP LOCKED claim: `db/queries/outbox.sql`.
- Short atomic tx: `internal/storage/db.go` `InTx`; `internal/booking/service.go` `Apply`.
- Optional per-technician serialization: `booking.WithFlow`.

## Anti-patterns
- Making correctness depend on Redis (fail-closed locking) — a blip then becomes an outage.
- A non-idempotent outbox consumer (double-processes on redelivery).
- Holding a DB transaction open across an HTTP/provider call.
- Adding offset pagination or returning unbounded slices for admin/ops lists.

## Checklist
- [ ] New flow-layer use degrades permissively; DB still enforces the invariant.
- [ ] New outbox consumer is idempotent (unique-index/existence backed).
- [ ] Transactions stay short; no I/O inside `InTx`.
- [ ] New `/ops/*` list endpoints use keyset pagination.
- [ ] Service methods and loops honour `ctx` cancellation.
