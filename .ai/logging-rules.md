# Logging Rules

## Purpose
Keep logging structured, threaded, and free of secrets. Grounded in review Phase 13 and
`cmd/api/main.go`, `internal/app/consumers.go`, `internal/httpapi`.

## Rules
1. Use **`log/slog` with the JSON handler only** — construct it once in the composition root
   (`slog.New(slog.NewJSONHandler(os.Stdout, …))` in `cmd/api/main.go`) and thread it through
   `Dependencies.Logger` / handler fields; don't create ad-hoc loggers deep in packages.
2. **Never log secrets or OTP codes** in production paths — no JWT secrets, Razorpay/Cloudinary keys,
   or OTP plaintext. The only place a code is logged is the **dev** `LogSender`/`SETHU_DEV_OTP` seam,
   guarded by config, so it can't leak by default.
3. Log a request failure at the boundary once: `toHumaError` logs when `status >= 500` and returns an
   opaque "internal error"; don't also log the same error deeper.
4. Log with **key/value attributes**, not string interpolation
   (`log.Error("request failed", "err", err)`), so logs stay queryable.
5. A `≥500` is logged server-side with the real error; the client sees only "internal error" — never
   put internal detail in the client response.
6. In background loops/consumers, log through the injected logger (`deps.Logger`) and include
   correlating keys (`"booking_id"`, `"purpose"`).
7. There is **no request-logging middleware yet** (review notes this as the main observability gap);
   if you add one, keep it structured slog and secret-free.

## Examples
- Root JSON logger + injection: `cmd/api/main.go` (`logger := slog.New(...)`, `Logger: logger`).
- 5xx-logged-then-opaque: `internal/httpapi/huma.go` `toHumaError`.
- Consumer logging with keys (dev OTP seam): `internal/app/consumers.go`
  (`deps.Logger.Info("DEV job otp issued", "booking_id", …, "code", code)`).

## Anti-patterns
- `fmt.Println`/`log.Printf` or a text handler instead of JSON slog.
- Logging OTP codes, tokens, or provider secrets outside the guarded dev seam.
- Returning the raw internal error to the client on a 5xx.
- String-formatted log messages instead of structured key/value attrs.

## Checklist
- [ ] Uses the injected `slog` JSON logger, not an ad-hoc one.
- [ ] No secret/OTP logged outside the config-guarded dev seam.
- [ ] 5xx logged once server-side; client response is opaque.
- [ ] Log calls use key/value attributes.
