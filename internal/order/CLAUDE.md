# internal/order — CLAUDE.md

## Purpose
Owns the PURCHASE concept — what the customer bought and paid for (one payment), which fans out into one booking per technician visit. In P0/P1 an order has exactly one booking (a unique index P3 drops). Today this package is an **enum only**: there is no service, and `orders` rows are written directly by `booking.Create`.

## Responsibilities
- Define `Status` (the money-side state of a purchase, distinct from `booking.State` which tracks the work) and its boundary helpers. That is all — no I/O, no service.

## Owns
`orders` (the table exists and is drift-guarded), but **no service writes through this package** — `booking.Create` writes `orders` rows. So in practice: enum only.

## Allowed Dependencies
Standard library (`fmt`) only. It is a pure leaf.

## Forbidden Dependencies
Everything internal — this package has (and should keep) zero internal imports.

## Contains
- `status.go` — `Status` (PENDING/PAID/REFUNDED/CANCELLED) with `AllStatuses`/`Valid`/`ParseStatus`/`String`; DB CHECK on `orders.status` + drift test. Imported in production only by `schema/drift_test.go`.

## Examples
```go
status, err := order.ParseStatus(raw) // the only place a raw DB string becomes an order.Status
if status == order.StatusPaid { /* ... */ }
```

## Best Practices
- Keep it a pure leaf: no `pgx`, no `context`, no other internal package.
- Keep the enum in lockstep with the `orders.status` DB CHECK and the drift test.

## Common Mistakes
- Confusing `order.Status` (the money) with `booking.State` (the work) — they are deliberately separate.
- Assuming there's an order service to call — there isn't; booking writes `orders` today.
- NOTE: the architecture review flags `order` as dead-in-production (only the drift test imports it) and recommends **either** promoting it to a real context that owns `orders` (booking would emit an event instead of writing the row) **or** folding `Status` into a shared kernel and deleting the package. Decide deliberately before adding to it.
