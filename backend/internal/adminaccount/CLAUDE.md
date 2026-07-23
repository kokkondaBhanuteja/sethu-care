# internal/adminaccount — CLAUDE.md

## Purpose
Owns the ops console's sign-in surface and the admin's own record: admin accounts (email + bcrypt password + lockout), trusted devices, the second-factor challenge ENVELOPES, per-account console settings, and diagnostics uploads. It is NOT a second OTP system — codes are issued/verified by `internal/identity`'s engine (bcrypt rows in `otp_challenges`, demo-account bypass included); this package only binds a `challengeId` to an account + device and enforces the console's stricter 3-guess budget.

## Responsibilities
- `Login` — lock check → bcrypt compare (timing-equalized dummy hash for unknown emails) → disabled check → trusted-device fast path, else mint a challenge via `identity.RequestOTP`. 5 failures → 15-minute lock (`LockedError`, the 423).
- `VerifyOTP` — trust-slot check FIRST (so a 409 never spends the single-use code and the revoke-then-retry flow works), then `identity.VerifyOTP`; opens the session, registers/trusts the device, audits.
- `ResendOTP` — 3 per 10 minutes per account (`ResendLimitedError` carries resetAt); supersedes the previous envelope (only the latest code is valid); accepts an expired envelope, never a consumed one.
- Devices: `TrustedDevices`, `RevokeDevice` (idempotent replay: an already-revoked device returns the first result), session bookkeeping (`Logout`, `SessionAccount`), `Unlock` (password step-up; wrong attempts feed the same lockout counter; success clears it).
- Settings: `Profile`/`UpdatePreferences`, `NotificationSettings`/`Update…` (configurable tier only), `SecuritySnapshot`/`SetBiometricUnlock`, `SubmitDiagnostics` (PII sweep + Idempotency-Key-backed unique index).

## Owns
`admin_accounts`, `admin_devices`, `admin_challenges`, `admin_settings`, `admin_diagnostics` (migration `00020`). Writes `audit_logs` rows via `audit.Record` (actions `ADMIN_SIGNED_IN`, `ADMIN_SIGN_IN_FAILED`, `ADMIN_DEVICE_TRUSTED`, `ADMIN_DEVICE_REVOKED`, `ADMIN_SIGNED_OUT`) and reads them back as the security screen's events — the `/ops/audit` list filters to its own action set, so these never appear there.

## Allowed Dependencies
`identity` (the OTP engine — required constructor dep), `audit`, `storage`/`sqlcgen`, stdlib, `pgx`, `uuid`, `bcrypt`.

## Forbidden Dependencies
`httpapi`/`huma`/`config`; any consumer. A core per depguard conventions.

## Contains
- `service.go` — `NewService(pool, identityService, ...Option)`, `WithClock`; the auth flows; errors `ErrInvalidCredentials`, `ErrAccountDisabled`, `ErrChallengeExpired`, `ErrOtpAttemptsExhausted`, `ErrDeviceNotFound`, `ErrAccountNotFound`; typed `LockedError`/`InvalidOtpError`/`DeviceLimitError`/`ResendLimitedError`. Policy consts: 5 attempts/15 min lock, 3 code guesses, 3 resends/10 min, 30-day trust, 3 slots.
- `settings.go` — settings/profile/security/diagnostics; `ErrInvalidSetting` (422), `ErrDiagnosticsPII` (422). GETs tolerate a missing account (honest defaults); writes require one (`ErrAccountNotFound` → 404).
- `enums.go` — `DeviceType` (PHONE/TABLET/DESKTOP) and `AppearanceMode` (LIGHT/DARK/SYSTEM), UPPER_SNAKE per enum-rules, pinned by `internal/schema/drift_test.go`; the transport maps to the contract's lowercase wire values. `SecurityEventKind` is derived from audit actions, not persisted.

## Known honest gaps (documented, not bugs)
- JWTs are stateless and not device-bound: logout/revoke close session BOOKKEEPING; the token stays valid until its TTL. "Current device" is a heuristic (most recently used open session).
- `admin_devices.location` stays `""` — no geo-IP lookup exists.
- Login's SMS path is the transport layer's job (like `AuthHandler`); inside identity's 30s resend guard `Login` returns `Code == ""` (previous code still live, no new SMS).

## Common Mistakes
- Adding a code column to `admin_challenges` — the code belongs to identity's `otp_challenges`, full stop.
- Verifying the code before the trust-slot check — that burns the single-use code on a 409 and breaks the device-limit picker's retry.
- Auditing anything secret — payloads carry device name/id and email only, never passwords or codes.
