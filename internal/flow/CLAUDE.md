# internal/flow — CLAUDE.md

## Purpose
INFRA. Redis-backed request-flow primitives: distributed locks, slot holds, rate limiting, and idempotency memory. Deliberately a FLOW layer, not a correctness layer — the database (EXCLUDE constraint, version CAS, idempotent capture) is what actually guarantees no double-book / no double-charge. So every primitive DEGRADES PERMISSIVELY when Redis is absent: the service runs correctly with Redis down, just with less smoothing under contention.

## Responsibilities
- Compare-and-delete distributed locks (`Lock`, `LockWait`).
- Fixed-window rate limiting that fails open (`Allow`).
- Idempotency result cache (`Remember`, `Recall`).
- Slot reservation holds (`Reserve`, `Release`).

## Owns
none (Redis keyspace, no DB table).

## Allowed Dependencies
`go-redis/v9` only, plus stdlib. No internal imports.

## Forbidden Dependencies
- Anything internal (it is a kernel/infra leaf). No domain, no `storage`, no `httpapi`.

## Contains
- `Controller` wrapping a `*redis.Client`; a nil client = "disabled" (every method returns the permissive answer).
- `New(ctx, url)` — empty url → disabled (no error); connect error → returned so caller decides. `Disabled()` — always-permissive controller. `Enabled()`, `Close()`.
- `Lock(ctx, key, ttl) → (release func(), acquired bool, err)` — `SetNX` with `lock:` prefix; release via a compare-and-delete Lua script (never steals a re-taken lock). Disabled → always acquires.
- `LockWait(ctx, key, ttl, maxWait)` — bounded retry; timeout returns `acquired=false` with NO error (caller proceeds; DB is the real guard).
- `Allow(ctx, key, limit, window) → (bool, err)` — INCR+EXPIRE fixed window under `rl:`; FAILS OPEN on any Redis error.
- `Remember(ctx, key, value, ttl)` / `Recall(ctx, key)` — idempotency cache under `idem:`.
- `Reserve(ctx, key, value, ttl)` / `Release(ctx, key)` — slot hold under `hold:`.
- Key prefixes `lock:` / `rl:` / `idem:` / `hold:` are inline literals (review: make named consts — Phase 6).

## Examples
```go
control, _ := flow.New(ctx, cfg.RedisURL)      // or flow.Disabled()
release, _, _ := control.Lock(ctx, "booking:"+id, 10*time.Second)
defer release()
allowed, _ := control.Allow(ctx, "ip:"+addr, 240, time.Minute) // fails open
```

## Best Practices
- Treat every primitive's answer as advisory — the DB constraint is authoritative. Never let a lock/hold be your ONLY guard against a double-write.
- Always `defer release()` after `Lock`/`LockWait` (release is a safe no-op if the lock was lost).
- On a Redis error, do the permissive thing (allow/acquire) — a Redis blip must not take the API down.

## Common Mistakes
- Relying on `flow` for correctness (e.g. skipping the DB EXCLUDE/CAS because "the lock held").
- Failing closed on a Redis error — that turns an outage into an API outage.
- Assuming `LockWait` timeout is an error — it isn't; the caller is expected to proceed.
