# internal/ledger — CLAUDE.md

## Purpose
Owns the money (ROADMAP §6): revenue, cash custody/deposit, goodwill credits, and UPI collection/capture. Customers pay the COMPANY; technicians are salaried (money never flows company→technician per job). The ledger is **append-only** — enforced by a DB trigger, not convention: you never mutate a row, you write an offsetting one.

## Responsibilities
- `RecordCompletion` — the `booking.completed` consumer (idempotent): CASH → `CASH_CUSTODY`; UPI/ONLINE → a PENDING collection (revenue is NOT booked here); warranty (zero total) → nothing.
- `IssueFailureCredit` — the `booking.failed` consumer (idempotent): a `CREDIT_ISSUED` attached to the order.
- `RecordDeposit` — a technician hands in held cash (`CASH_DEPOSIT` offsets `CASH_CUSTODY`).
- `CaptureUPIPayment` — the money-moved moment: marks the collection CAPTURED and books `REVENUE` atomically (idempotent).
- Reads: `Reconciliation`, `PositionForTechnician`, `PendingPayments`, `CollectionForBooking`; `SetPaymentLink` persists the hosted link.

## Owns
`ledger_entries`, `payments`, and the read view `technician_cash_position`.

## Allowed Dependencies
`booking` (billing consumes booking types — a documented, deliberate compile-time coupling), `money`, `storage` (+`sqlcgen`), stdlib, `pgx`, `google/uuid`.

## Forbidden Dependencies
`httpapi`/`huma`/`config` (never). It is a consumer, so nothing imports it back into a core.

## Contains
- `service.go` — `Service`, `NewService(pool)`; the methods above; `CashPosition`, `Collection`, `PendingPayment`; errors `ErrBookingNotFound`, `ErrPaymentNotFound`, `ErrNoCustody`, `ErrNotYourCustody` (403), `ErrAlreadyDeposited` (409).
- `enums.go` — `EntryKind` (REVENUE/CASH_CUSTODY/CASH_DEPOSIT/CREDIT_ISSUED/CREDIT_REDEEMED, with `AttachesToOrder`/`IsCash`), `PaymentMethod` (UPI/CASH/ONLINE), `PaymentStatus` (PENDING/CAPTURED). Full enum pattern + DB CHECK + drift test.

## Examples
```go
led := ledger.NewService(pool)
// booking.completed consumer:
err := led.RecordCompletion(ctx, bookingID, ledger.PaymentCash) // idempotent
// PSP webhook / admin confirm:
err = led.CaptureUPIPayment(ctx, reference, providerRef)        // books REVENUE + marks CAPTURED atomically
```

## Best Practices
- Consumers must be idempotent — every write is guarded (`CompletionLedgerExists`, `CreditExistsForOrder`, `DepositExistsForBooking`) so at-least-once redelivery is harmless.
- Corrections are offsetting entries, never UPDATE/DELETE (the `forbid_mutation` trigger rejects them).
- Multi-write moves (capture = REVENUE + mark-captured) go through `storage.InTx`.
- Money attaches at the right level: REVENUE/credits → order, cash custody/deposit → booking (the DB CHECK enforces the same split `EntryKind.AttachesToOrder` encodes).

## Common Mistakes
- Booking REVENUE at completion time for UPI — revenue is booked only when the money lands (`CaptureUPIPayment`).
- Recording cash custody for a UPI job (the money never touches the technician — a contradiction `IsCash` guards).
- Trying to "fix" a row by mutation instead of an offsetting entry.
