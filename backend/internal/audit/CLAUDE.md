# internal/audit — CLAUDE.md

## Purpose
Records who did what to which entity, with a before/after snapshot. Every entry is written INSIDE the caller's transaction, so the audit row commits atomically with the change it describes — the log can never disagree with what actually happened. This is the who/before/after dimension the money ledger does not carry.

## Responsibilities
- Marshal before/after snapshots to JSONB and insert one `audit_logs` row using the caller's tx.
- Infer `ActorKind` when the caller leaves it blank.
- Read side for the admin console (`list.go`): `Service`/`NewService(pool)` with `List(ctx, ListFilter)` — admin-actor booking entries within `AdminActions()` (ASSIGN/CANCEL/VERIFY_COMPLETION/SEARCH), newest first, keyset cursor (limit+1 peek), whole-set total + timestamp range, snapshots flattened to `map[string]string`. `ErrInvalidCursor` → 400.
- Idempotent-replay store for admin mutations (`idempotency.go`): `ActionKeyID(operation, subject, key)` derives a UUIDv5; the first receipt is stored as an `audit_logs` row under `entity_type='admin_action_key'` (`RecordAdminAction`) and replayed by `ReplayAdminAction`/`UnmarshalReceipt`. Lookup-then-insert without a unique guard — sequential replays always hit; simultaneous duplicates fall to the domain's own CAS. Also `CountAdminActionsSince` (entity_type pinned to `booking` so replay rows never double-count) — the refund rate limit's counter.

## Owns
`audit_logs`. A leaf sink — nothing calls back into it. (`List`'s SQL joins `users` read-only for the admin's name; identity stays the owner.)

## Allowed Dependencies
`storage/sqlcgen` (`DBTX`), `pgx`/`pgxpool` (the read `Service` holds a pool), `google/uuid`, `encoding/json`, stdlib.

## Forbidden Dependencies
- No other domain module (it is a leaf), no `httpapi`, no `config`.

## Contains
- `ActorKind` enum: `ActorUser = "user"`, `ActorSystem = "system"`, `ActorGateway = "gateway"`. NOTE: values are LOWERCASE (every other enum is UPPER) and it has no `Valid()`/`Parse()` and is NOT drift-tested despite backing `audit_logs.actor_kind` CHECK — a known inconsistency to fix (change Go + DB CHECK together), not to imitate.
- `Entry{ActorUserID, ActorKind, Action, EntityType, EntityID, Before, After, CorrelationID}` — `Before`/`After` are any, marshalled to JSONB (nil → SQL null). Blank `ActorKind` infers `user` if `ActorUserID` is set, else `system`.
- `Record(ctx, tx sqlcgen.DBTX, entry)` — writes with the caller's tx (pass the SAME tx as the business write).
- `marshal(value)` helper.

## Examples
```go
storage.InTx(ctx, pool, func(tx pgx.Tx) error {
    // ... the business write on the same tx ...
    return audit.Record(ctx, tx, audit.Entry{
        ActorUserID: &userID,
        Action:      "booking.confirm",
        EntityType:  "booking",
        EntityID:    bookingID,
        Before:      prev,
        After:       next,
    })
})
```

## Best Practices
- ALWAYS pass the same tx as the change being audited — never a fresh pool/tx (the row must commit with the change).
- Let `ActorKind` infer when it's obvious; set `ActorGateway` explicitly for webhook-driven changes.
- Snapshot only what's needed for the trail; before/after are opaque JSONB.

## Common Mistakes
- Calling `Record` with a pool or a different transaction, breaking atomicity with the audited write.
- Adding a new `ActorKind` value without updating the DB CHECK (no drift test guards this one yet).
- Assuming casing matches other enums — `audit` is lowercase on purpose (for now).
