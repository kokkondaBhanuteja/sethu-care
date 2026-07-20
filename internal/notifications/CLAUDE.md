# internal/notifications — CLAUDE.md

## Purpose
The customer-facing voice of the system. Consumes booking events off the outbox and, for the ones a customer should hear about, records and sends a message. Also the seam that delivers job OTP codes (START/COMPLETION).

## Responsibilities
- `Notify` — record + send the SMS for a booking event (if it has a template), idempotently.
- `SendJobCode` — deliver a freshly issued job OTP to the booking's customer (never persisted).
- Keep an append-only durable record of what the customer was told (`notification_log`).

## Owns
`notification_log`.

## Allowed Dependencies
`sms` (the `Sender`/OTP port), `storage/sqlcgen`, `pgx`, `google/uuid`, stdlib.

## Forbidden Dependencies
- No `httpapi`, no other domain services. It is a leaf consumer invoked via the outbox; it does not call back into booking/ledger/etc.

## Contains
- `Channel` enum (`ChannelSMS`, `ChannelPush`). NOTE: this enum lacks `Valid()`/`Parse()` and is NOT in the drift test even though it backs `notification_log.channel` CHECK — a known gap (Phase 6) to close, not to copy.
- `Service` — `NewService(pool, sender, log, opts...)`, `WithOTPSender(sender)` (route job codes through a dedicated MSG91 template; else fall back to the generic Sender).
- `Notify(ctx, eventType, bookingID)` — looks up recipient, `InsertNotification` (idempotent via `(booking_id, event_type)` unique index; `inserted == 0` → already sent), then `sender.Send`. Events with no template (`messageFor` returns false) are skipped, returning nil so the outbox marks them handled.
- `SendJobCode(ctx, bookingID, purpose, code)` — sends via `otp` sender if set (template owns the copy), else generic Sender with `codeMessage`. Deliberately NOT written to `notification_log` (never persist a plaintext OTP).
- `sender.go` — `Outbound` message, `Sender` port, `LogSender` (dev/test default: the log IS the delivery).
- `messageFor(eventType)` — the template table for customer-facing events.

## Examples
```go
svc := notifications.NewService(pool, notifications.NewLogSender(log), log,
    notifications.WithOTPSender(msg91))
// Wired as an outbox consumer in internal/app:
dispatcher.SubscribeAll(func(ctx context.Context, e outbox.Event) error {
    if e.AggregateType != "booking" { return nil }
    return svc.Notify(ctx, e.EventType, e.AggregateID)
})
```

## Best Practices
- Keep idempotency at the DB unique index — a redelivered event must record and send nothing.
- Never log or persist an OTP code (`SendJobCode` bypasses the log on purpose).
- Return an error on a Send failure so the outbox retries (at-least-once, like every consumer).

## Common Mistakes
- Adding a new `Channel` value without the full enum pattern + DB CHECK + drift-test entry.
- Persisting job codes into `notification_log` (turns the audit log into a credential store).
- Interpolating unvalidated per-booking data into copy — templates are deliberately static for now.
