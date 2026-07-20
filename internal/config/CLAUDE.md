# internal/config — CLAUDE.md

## Purpose
Loads and validates every environment-driven setting once, at startup, so the rest of the program receives a typed, checked `Config` value instead of reaching into `os.Getenv` from scattered places.

## Responsibilities
- Read env vars, apply defaults, parse-validate, and return one `Config`.
- Keep secrets defaulting to empty (empty ⇒ that feature is degraded/off), except a friendly dev JWT secret that flags `UsingDevJWTSecret` so the caller can warn.

## Owns
none.

## Allowed Dependencies
stdlib (`os`, `strconv`, `time`, `fmt`) only. (godotenv is loaded in `cmd/api`, not here.)

## Forbidden Dependencies
- **Anything internal.** It is a leaf, passed around as values; nothing internal imports it except `cmd/api`. Domain services must NOT import `config` (Phase 4 forbidden rule).

## Contains
- `Config` struct — `DatabaseURL`, `RedisURL`, `ListenAddr`, `JWTSecret`, `JWTTTL`, `UsingDevJWTSecret`, `DevEchoOTP`, `FailedBookingCreditPaise`, UPI (`UPIVirtualAddress`, `UPIPayeeName`), Cloudinary (`CloudinaryCloudName/APIKey/APISecret`), demo login (`DemoPhone`, `DemoOTP`), MSG91 (`MSG91AuthKey/SenderID/TemplateID`), Razorpay (`RazorpayKeyID/KeySecret/WebhookSecret`).
- `Load() (Config, error)` — the ONLY error is a value that is present but malformed (e.g. an unparseable duration); a MISSING var falls back to a hardcoded default (boot never fails on a missing key). `defaultDevJWTSecret` when `JWT_SECRET` unset (long enough to satisfy the signer, flags `UsingDevJWTSecret`).
- Helpers: `stringEnv`, `intEnv`, `durationEnv` (accepts a Go duration "24h" or a plain number of seconds).

## Examples
```go
cfg, err := config.Load()
if err != nil { log.Fatal(err) }
if cfg.UsingDevJWTSecret { log.Warn("using insecure dev JWT secret") }
signer, _ := auth.NewSigner(cfg.JWTSecret, cfg.JWTTTL)
```

## Best Practices
- Read config once in `cmd/api` and inject the values downstream — never call `os.Getenv` inside a domain service.
- Keep `os.Getenv` — do NOT add a config framework (viper etc.); over-engineering at this size.
- Empty secret = feature off is the intended convention; a call site reads emptiness as "disabled".

## Common Mistakes
- Importing `config` from a domain package (forbidden — pass the value in instead).
- Expecting boot to fail on a missing secret — today it silently defaults/degrades (review recommends `APP_ENV` fail-fast on prod secrets — Phase 10, not yet implemented).
- Adding an inline magic number in a service instead of threading a tunable through `Config`.
