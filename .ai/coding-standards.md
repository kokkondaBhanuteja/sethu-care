# Coding Standards

## Purpose
Cross-cutting standards every Go file in this repo follows: naming, errors, configuration, and the
toolchain gates. Grounded in review Phases 9, 10, 13 and `AGENTS.md` §3.

## Rules
1. **No single-letter identifiers.** Every variable, parameter, and receiver gets a descriptive name
   (`booking`, `amount`, `service`), including method receivers (`func (amount Money) Add(...)`).
   This is a hard rule (`AGENTS.md`).
2. Comments state **constraints, not narration** — say *why* an invariant holds, matching the
   surrounding density (see the "GO LESSON" comments in `internal/money/money.go`).
3. `ctx context.Context` is the first parameter of every service method; background loops select on
   `ctx.Done()`.
4. **Errors, three tiers** (review Phase 9):
   - Sentinel `var Err… = errors.New("pkg: …")` (package-prefixed) for value-less conditions
     (`ledger.ErrPaymentNotFound`).
   - Typed struct errors carrying data, matched with `errors.As`
     (`booking.ConflictError`, `ScheduleConflictError`, `ForbiddenError`).
   - Wrap on the way up with `fmt.Errorf("…: %w", err)`; never `%v` for an error you want in the chain.
5. Map errors to HTTP in **exactly one place**: `classify()` in `internal/httpapi/errors.go`.
   A ≥500 is logged server-side and returned opaque ("internal error") — never leak internals.
6. **Config** lives only in `internal/config/config.go`: `os.Getenv` + `stringEnv/intEnv/durationEnv`
   helpers, every var defaulted, `godotenv` non-overriding. Do not add a config framework (viper).
   Recommendation to adopt: an `APP_ENV` that makes `Load()` **fail fast** on empty prod secrets
   (`JWT_SECRET`, `DATABASE_URL`) instead of the current dev-default warning.
7. **No inline magic numbers** for tunables (TTLs, limits, timeouts) — name them as typed consts near
   their owner or pull them from config (review Phase 6/10).
8. Run `gofmt`/`goimports` (husky pre-commit) and `make check` before committing. Never `--no-verify`.

## Examples
- Sentinel + typed errors: `internal/booking/service.go` (`ErrBookingNotFound`, `ConflictError`).
- Multi-`%w` wrapping: `money.FromRupees` returns `fmt.Errorf("%w: %q: %w", ErrOverflow, input, err)`.
- Config defaulting: `internal/config/config.go` `stringEnv("ADDR", ":8080")`, dev JWT secret fallback.

## Anti-patterns
- `err.Error()` string matching instead of `errors.Is/As` (errorlint flags it).
- Returning a raw pgx/driver error to transport (leaks a 500 with DB detail).
- A bare `240`, `24*time.Hour`, or `5` inline where a named const/config value belongs.
- Silencing an `errcheck`/`exhaustive` failure with `default:` or `_ =` instead of handling it.

## Checklist
- [ ] No single-letter names; receivers are descriptive.
- [ ] New errors are package-prefixed sentinels or typed structs, wrapped with `%w`.
- [ ] Any new error type has a mapping in `classify()`.
- [ ] New tunables are named consts or config, not inline literals.
- [ ] `make check` green (lint + openapi-check + `-race`).
