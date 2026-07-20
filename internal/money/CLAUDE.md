# internal/money — CLAUDE.md

## Purpose
KERNEL value object. `type Money int64` in PAISE — the single type every rupee in the system flows through. A defined type (not an alias), so `Money` and `int64` are distinct: `FromRupees("599")` and `FromPaise(599)` can no longer be confused. Prevents REPRESENTATION errors (wrong unit / rounding / sign), not logic errors.

## Responsibilities
- Construct money safely from paise or from a human rupee string (no float).
- Provide overflow-checked arithmetic and rendering.
- Guard the non-negative columns where a negative amount is nonsense.

## Owns
none (a pure value type; it owns no table).

## Allowed Dependencies
stdlib only (`errors`, `fmt`, `math`, `strconv`, `strings`).

## Forbidden Dependencies
- **ANYTHING internal.** Enforced by depguard `money-is-a-pure-leaf` — importing any `github.com/kokkondaBhanuteja/sethu-care/internal` package fails the build. It is the deepest leaf; if a rule leaks into it, the value type is wrong.

## Contains
- `type Money int64`; `Zero Money = 0`.
- Sentinels: `ErrInvalidAmount`, `ErrSubPaise`, `ErrNegative`, `ErrOverflow` (wrapped with `%w` — compare via `errors.Is`).
- Constructors: `FromPaise(int64)`, `FromRupees(string)` (parses "599"/"499.99"/"-250"; rejects sub-paise like "1.005" with `ErrSubPaise`; NOT float), `MustFromRupees(string)` (panics — constants/tests only).
- Arithmetic (value receivers, immutable): `Add`/`Sub`/`Mul` — panic on overflow (a crash beats a corrupt append-only ledger row). `Sub` may go negative (that's how the ledger corrects itself).
- Queries: `Paise()`, `IsZero()`, `IsNegative()`, `RequireNonNegative()` (opt-in guard, deliberately NOT in the constructor since negative money must be constructible for offsetting entries).
- Rendering: `Rupees()` → "499.99", `String()` → "₹499.99" (satisfies `fmt.Stringer`).

## Examples
```go
price, err := money.FromRupees("499.99")   // user input → check err
total := price.Mul(3)                        // overflow-checked
if err := total.RequireNonNegative(); err != nil { /* reject */ }
razorpayAmount := total.Paise()              // gateway + DB speak paise
const credit = money.MustFromRupees("100")   // a controlled literal
```
JSON marshals as a plain int64 number; DB stores BIGINT via the sqlc `*_paise → money.Money` override.

## Best Practices
- NEVER use float for money — parse rupee strings via `FromRupees`.
- Be explicit about units at every boundary: `FromPaise` for Postgres/Razorpay, `FromRupees` for human input.
- Use `MustFromRupees` only for compile-time-known literals; never on request data.

## Common Mistakes
- Passing an `int64` where paise vs rupees is ambiguous — always go through a constructor.
- Adding any internal import (breaks `money-is-a-pure-leaf`).
- Expecting the constructor to reject negatives — it doesn't; call `RequireNonNegative` where you need the guard.
