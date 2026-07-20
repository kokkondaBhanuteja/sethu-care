# Go Style

## Purpose
The idiomatic-Go conventions this codebase holds itself to, beyond formatting — so new code reads like
the code already here. Grounded in review Phase 13 and the in-repo "GO LESSON" comments.

## Rules
1. **No single-letter identifiers** anywhere — variables, params, and receivers alike. Use
   `func (amount Money) Add(other Money)`, never `func (m Money) Add(o Money)`.
2. Exported identifiers are PascalCase; keep names domain-descriptive (`CanPerform`, `AllStates`,
   `ScheduleConflictError`).
3. Sentinel errors are `var`, package-prefixed: `errors.New("booking: not found")`. `var` is reserved
   for values that genuinely can't be `const` (sentinels, `regexp.MustCompile`).
4. Prefer **value receivers** for small immutable values (`Money`) so methods can't mutate the
   receiver; use pointer receivers only when mutation or large structs demand it.
5. Use defined types, not aliases, for domain vocabulary: `type Money int64` (safety) not
   `type Money = int64` (no safety). Same for `type State string`.
6. `ctx` is always the first parameter. Use closures for transaction scope (`storage.InTx(ctx, pool,
   func(tx pgx.Tx) error { … })`) rather than manual begin/commit.
7. Satisfy interfaces implicitly — declare the method (`String() string`), don't restate intent; there
   is no `implements`.
8. `gofmt` + `goimports` are enforced by the husky hook; keep imports grouped stdlib / third-party /
   internal as the existing files do.
9. Keep switch statements over enums **exhaustive** — the `exhaustive` linter runs with
   `default-signifies-exhaustive: false`, so a `default:` will NOT excuse a missing case.

## Examples
- Value receiver + defined type: `internal/money/money.go`.
- Exhaustive-linted switch over an enum: `internal/booking/state.go` `Valid()`, `permission.go`
  `CanPerform`.
- Closure transaction scope: `internal/storage/db.go` `InTx`.

## Anti-patterns
- `m`, `s`, `e`, `i` as names — fails review and the repo's hard rule.
- `type X = int64` alias where a defined type is intended (silently drops type safety).
- Pointer receiver on a small value type, enabling accidental mutation.
- Ending an enum switch with `default:` to quiet the linter (masks the next added case).

## Checklist
- [ ] All identifiers descriptive (no single letters).
- [ ] Enum switches are exhaustive, no linter-silencing `default:`.
- [ ] Small immutable types use value receivers.
- [ ] Domain types are defined types, not aliases.
- [ ] `gofmt`/`goimports` clean.
