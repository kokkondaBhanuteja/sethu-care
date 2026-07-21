# internal/sms — CLAUDE.md

## Purpose
ADAPTER. Delivers one-time codes over SMS. Defines the `Sender` PORT and its two implementations — `MSG91` (real, DLT-approved template) and `LogSender` (dev, the log is the delivery). A leaf: it imports nothing from the domain, so any caller (login, job-code issuance) can be handed a `Sender` without creating an inward dependency.

## Responsibilities
- Define the outbound OTP delivery port.
- Provide a real MSG91 Flow-API implementation and a dev/logging one.

## Owns
none.

## Allowed Dependencies
stdlib (`net/http`, `encoding/json`, `context`, `log/slog`, ...) only.

## Forbidden Dependencies
- No domain module, no `storage`, no `httpapi`. The concrete `Sender` is chosen in the composition root and injected.

## Contains
- `Sender` interface — `SendOTP(ctx, phone, code) error`. One method; the caller never knows the provider.
- `LogSender` — `NewLogSender(log)`; dev default (prints the live code — NEVER use in production).
- `MSG91` (`msg91.go`) — `NewMSG91(authKey, templateID)`; posts to MSG91 v5 Flow (`control.msg91.com/api/v5/flow`) with the DLT template; strips a leading `+` from the mobile; `realTimeResponse` so a bad template surfaces synchronously; 10s HTTP timeout.

## Examples
```go
var sender sms.Sender
if cfg.MSG91AuthKey != "" && cfg.MSG91TemplateID != "" {
    sender = sms.NewMSG91(cfg.MSG91AuthKey, cfg.MSG91TemplateID) // prod
} else {
    sender = sms.NewLogSender(log)                               // dev
}
_ = sender.SendOTP(ctx, "+919347305870", code)
```
`notifications.WithOTPSender(sender)` routes job codes through this port.

## Best Practices
- Choose the implementation once, in `cmd/api`, based on config; depend on the `Sender` interface everywhere else.
- The DLT template owns the message text — MSG91 gets only the code variable.
- Return an error on non-success so the caller (outbox consumer) retries.

## Common Mistakes
- Shipping `LogSender` to production (leaks live OTP codes).
- Sending the mobile with a leading `+` (MSG91 wants international format WITHOUT it — `MSG91.SendOTP` trims it).
- Adding a domain import here and inverting the dependency direction.
