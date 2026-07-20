# internal/verification — CLAUDE.md

## Purpose
Owns the dual-OTP scheme (Start proves the technician reached the customer; Completion proves the work was finished before payment) and the photographic evidence of work. The two OTPs are a security control, not bookkeeping — the `Purpose` column is what stops a Start code being replayed as a Completion.

## Responsibilities
- `IssueOTP(bookingID, purpose)` — mint a job code (START/COMPLETION), bcrypt-hashed, 10-min TTL, attempt-capped; **idempotent** (a live challenge already present ⇒ no-op, `issued=false`) so a redelivered event can't invalidate the customer's code.
- `Guard(bookingID, purpose, code)` — returns `func(ctx, tx) error` that verifies-and-consumes the OTP **inside the caller's transaction**. `booking.Apply` runs it in the same tx as the state change: a wrong/exhausted code rolls everything back — you can never spend an OTP without advancing, or advance without one.
- Work photos: `SaveWorkPhoto` (only the assigned technician may add), `ListWorkPhotos`, `BookingParties` (for authorizing who may view).

## Owns
`otp_challenges` rows of job purpose (START/COMPLETION), `work_photos`.

## Allowed Dependencies
`storage/sqlcgen`, stdlib, `pgx`, `google/uuid`, `golang.org/x/crypto/bcrypt`.

## Forbidden Dependencies
`httpapi`/`huma`/`config`, and `booking` (verification is downstream of booking; booking calls `Guard`, not the reverse). It's a consumer — nothing imports it back into a core.

## Contains
- `purpose.go` — `Purpose` (LOGIN/START/COMPLETION, with `RequiresBooking`); DB CHECK + drift test.
- `workphoto.go` — `WorkPhotoKind` (BEFORE/AFTER); DB CHECK + drift test.
- `service.go` — `Service`, `NewService(pool)`, `IssueOTP`, `Guard`; errors `ErrOtpInvalid`, `ErrOtpTooManyAttempts`. OTP tuning: TTL 10m, 5 attempts, 6 digits.
- `photo_service.go` — `SaveWorkPhoto`, `ListWorkPhotos`, `BookingParties`; `WorkPhoto`, `Parties`; errors `ErrBookingNotFound`, `ErrNotAssignedTechnician`.

## Examples
```go
ver := verification.NewService(pool)
code, issued, err := ver.IssueOTP(ctx, bookingID, verification.PurposeStart) // idempotent

// gate a booking transition on the OTP, atomically:
_, err = bookings.Apply(ctx, bookingID, booking.ActionVerifyStart, booking.TransitionInput{
    Actor: &techID, ActorRole: identity.RoleTechnician,
    Guard: ver.Guard(bookingID, verification.PurposeStart, submittedCode),
})
```

## Best Practices
- `Guard` must run inside the booking transaction — verify+consume+advance are one atomic step.
- OTP codes are bcrypt-hashed, `crypto/rand`-generated, expiring, attempt-capped; codes are never persisted in plaintext.
- `IssueOTP` stays idempotent so the at-least-once outbox never mints a second code.

## Common Mistakes
- Verifying an OTP outside the state-change transaction (opens a spend-without-advance / advance-without-code gap).
- Issuing a job OTP for `PurposeLogin` (guarded by `RequiresBooking` + a DB CHECK).
- Letting anyone but the assigned technician upload work photos.
