# internal/identity — CLAUDE.md

## Purpose
Owns users (people who can authenticate) and the salaried technicians among them, plus login-OTP issue/verify. Also the home of `Role`, the RBAC vocabulary the rest of the system uses.

## Responsibilities
- `RequestOTP` — issue a 6-digit login code (bcrypt-hashed in the DB; plaintext returned to the caller, never stored); 30s resend guard.
- `VerifyOTP` — check code, consume the challenge, return the `User`; creates a CUSTOMER on first login (staff are pre-provisioned).
- `DeleteAccount` — anonymize-in-place (scrub PII, keep the append-only references intact); idempotent.
- Technician workforce: `RecomputeTechnicianRating` (the `review.submitted` consumer, idempotent), `SetAvailability` (+ `SetAvailabilityIn(ctx, executor, …)` — the tx-aware form providerops' force-offline uses so the flip commits with its audit entry), `UpdateTechnicianLocation`, `TechnicianLocationForBooking`.
- `ProvisionTechnician(ctx, executor, name, phone, city)` — creates the users row (role TECHNICIAN) + technicians row inside the CALLER's transaction (an application approval and the identity it creates commit atomically). `ErrPhoneAlreadyRegistered` (409) on a unique-phone collision — never auto-merges an existing account into a technician.

## Owns
`users`, `technicians`. Writes `otp_challenges` rows of purpose `LOGIN`.

## Allowed Dependencies
`storage/sqlcgen`, stdlib, `pgx`, `google/uuid`, `golang.org/x/crypto/bcrypt`.

## Forbidden Dependencies
Any consumer and `httpapi`/`huma`/`config`. `identity` is a **core** (depguard `cores-must-not-import-consumers`).

## Contains
- `role.go` — `Role` enum (CUSTOMER/TECHNICIAN/ADMIN) with `AllRoles`/`Valid`/`ParseRole`/`String`; DB CHECK on `users.role` + drift test.
- `service.go` — `Service`, `NewService(pool, ...Option)`, `WithDemoAccount(phone, code)` (App-Review bypass), `IsDemoPhone`; the methods above; `User`, `TechnicianLocation`; errors `ErrOtpRateLimited` (429), `ErrOtpInvalid`, `ErrOtpTooManyAttempts`. OTP tuning consts: TTL 5m, 5 attempts, 30s resend, 6 digits.

## Examples
```go
id := identity.NewService(pool, identity.WithDemoAccount(reviewPhone, reviewCode))
code, err := id.RequestOTP(ctx, phone)   // plaintext returned; SMS-sent by the transport layer
user, err := id.VerifyOTP(ctx, phone, code) // first login for an unknown phone → new CUSTOMER
```

## Best Practices
- OTP codes are bcrypt-hashed and generated with `crypto/rand` — never `math/rand`, never plaintext at rest.
- One error (`ErrOtpInvalid`) for wrong-code / unknown-phone / expired, so a caller can't distinguish them.
- Consumer methods (`RecomputeTechnicianRating`) are idempotent for at-least-once outbox delivery.

## Common Mistakes
- Logging or returning the OTP plaintext in production (dev-only; transport decides).
- Casting a raw `users.role` string to `Role` instead of `ParseRole`.
- NOTE: the architecture review recommends moving `Role` to a shared kernel (`internal/kernel/role`) so `booking`/`auth`/`ops`/`httpapi` stop importing a whole domain for one enum. Until then, `Role` lives here — don't duplicate it.
