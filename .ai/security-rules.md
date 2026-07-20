# Security Rules

## Purpose
The authentication, authorization, secrets, and webhook-integrity rules that keep the platform safe.
Grounded in review Phase 11 (§security) and `internal/auth`, `internal/verification`,
`internal/razorpay`, `internal/media`, `internal/httpapi`.

## Rules
1. **Pin JWT to HS256.** `Parse` uses `jwt.WithValidMethods([]string{"HS256"})` and rejects any other
   method — this defeats the classic `alg=none` and RS256-confusion forgeries. Never widen the allowed
   methods. Reject a short secret loudly at `NewSigner`.
2. Keep auth failures **vague**: one 401 regardless of expired vs tampered vs junk — never reveal
   which (`internal/auth/jwt.go`, `writeUnauthorized`).
3. Authorize in **two layers**: role via per-op `roleMetadata` + `CanPerform`, then **ownership inside
   the transaction** in `Apply` (acting only on your own booking / your assigned job). The JWT subject
   is a UUID with a `Valid()` role.
4. Take the caller from the token, never the body — a client must not name another `customer_id`
   (`bookings.go` uses `caller.ID`).
5. **Verify webhook integrity on raw bytes.** Razorpay webhooks: HMAC-SHA256 over the raw body under
   the webhook secret, compared in **constant time** (`hmac.Equal`) to `X-Razorpay-Signature` — verify
   before parsing. Cloudinary signed uploads: SHA-1 over sorted params + secret, verified on return.
6. **OTP hygiene** (login and job dual-OTP): store only a **bcrypt hash**, never plaintext; codes
   expire; attempts are capped then the challenge is burned (`ErrOtpTooManyAttempts`); `/auth/otp` has
   a 30s per-phone resend guard. Codes appear only in the guarded dev `LogSender`.
7. **Secrets never logged and never defaulted in prod.** Empty secret ⇒ feature degraded/disabled; a
   dev JWT secret only warns today — recommendation: fail fast on missing prod secrets via `APP_ENV`.
8. **Rate limiting fails open** — a Redis outage must not take the API down; `/health` and
   `/webhooks/*` are exempt (webhooks authenticate by signature instead).

## Examples
- HS256 pinning + vague 401: `internal/auth/jwt.go` (`WithValidMethods`, method-type check).
- `alg=none` rejection test: `internal/auth/jwt_test.go`.
- Constant-time webhook HMAC: `internal/razorpay/razorpay.go` `VerifyWebhook` (`hmac.Equal`).
- Cloudinary signature: `internal/media/cloudinary.go` `Sign`.
- Bcrypt-only OTP + attempt cap: `internal/verification/service.go`, `internal/identity/service.go`.
- Fail-open rate limit + exemptions: `internal/httpapi/ratelimit.go`.

## Anti-patterns
- Parsing a JWT without pinning the algorithm (opens `alg=none`/key-confusion).
- Verifying a webhook signature on the parsed struct instead of the raw bytes, or with `==` (timing).
- Persisting an OTP/token in plaintext, or logging it outside the dev seam.
- A fail-closed rate limiter that hard-depends on Redis.
- Trusting a body-supplied actor/role instead of the token.

## Checklist
- [ ] JWT parsing pins HS256; auth errors are opaque (single 401).
- [ ] Role + ownership both enforced (ownership inside the tx).
- [ ] Webhook HMAC verified on raw bytes in constant time before parsing.
- [ ] OTPs bcrypt-hashed, expiring, attempt-capped; never persisted/logged in plaintext.
- [ ] Secrets not logged; rate limiter fails open.
