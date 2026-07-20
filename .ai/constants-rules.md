# Constants Rules

## Purpose
Decide what becomes a named constant versus config, and where shared literals live, so contract
strings can't silently diverge. Grounded in review Phase 6 (magic-value inventory) and Phase 10.

## Rules
1. **No inline magic numbers/strings** for anything meaningful. A tunable becomes either a named typed
   `const` near its owner or an injected config value — never a bare literal in the middle of logic.
2. Choose the right kind:
   - `type X string` + const block for **persisted/serialized** enums (see `enum-rules.md`).
   - typed `const` for fixed domain quantities that deserve a name/type (TTLs, limits, batch sizes).
   - `var` only when it genuinely can't be `const` (`errors.New` sentinels, `regexp.MustCompile`).
   - `iota` only for purely in-memory, never-persisted ordinals (none qualify today — keep it so).
3. Give the **outbox event/topic names** a shared registry of typed `EventName` constants (recommended
   `internal/topics`). Publisher and every consumer must reference the same constant — these strings
   are the module contract and a typo silently drops an event.
4. Name the **Redis key prefixes** (`lock:`, `rl:`, `idem:`, `hold:`) as private consts inside
   `internal/flow`, not inline literals, so the keyspace is greppable.
5. Centralize **HTTP header names** (`Idempotency-Key`, `X-Forwarded-For`, `Retry-After`,
   `Authorization`, `WWW-Authenticate`, `X-Razorpay-Signature`) in a `httpapi/headers.go` const block.
6. Keep **SQLSTATE** codes as the named consts already in `internal/storage/errors.go`
   (`SQLStateUniqueViolation`, etc.) — reference those, never `"23505"` inline.
7. Numeric tunables (JWT TTL, OTP TTL/attempts/resend, rate limit, lock TTLs, server timeouts, the
   ₹100 failed-booking credit) flow from `config` where possible; the rest become named consts near
   their owner.

## Examples
- Named SQLSTATE consts: `internal/storage/errors.go`.
- Named auth/route metadata keys: `internal/httpapi/huma.go` (`securityBearer`, `roleMetadataKey`).
- Config-driven credit amount: `internal/config/config.go` `FailedBookingCreditPaise` (default ₹100).
- Topic strings still duplicated today (to registry-ize): `internal/app/consumers.go`
  (`"booking.completed"`, `"technician.arrived"`) vs `internal/notifications/notifications.go`.

## Anti-patterns
- The same event name typed as a literal in the publisher and each consumer (silent drift).
- `"23505"`, `"Idempotency-Key"`, `24*time.Hour`, or `lock:` inline in logic.
- Using `iota` for a value that is stored or serialized (ordinals are fragile across reordering).

## Checklist
- [ ] No new inline magic literal — it's a named const or config.
- [ ] New event/topic names reference the shared `EventName` registry (or the existing string is
      matched exactly on both sides).
- [ ] Redis prefixes / HTTP headers / SQLSTATE come from the named const blocks.
- [ ] Tunables sourced from `config` where they belong.
