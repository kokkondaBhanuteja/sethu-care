# internal/auth — CLAUDE.md

## Purpose
Signs and verifies the JWTs that authenticate a caller, and provides the net/http middleware that guards routes. A token is self-contained proof — authorization needs no database query.

## Responsibilities
- Issue HS256 tokens carrying `sub` (UUID) + `role`, with `iat`/`exp`.
- Parse/verify tokens, pinning the algorithm to HS256.
- Provide `RequireAuth` / `RequireRole` middleware and put/read `AuthedUser` in the request context.

## Owns
none.

## Allowed Dependencies
`identity` (for the `Role` enum only — the de-facto shared-kernel type; Phase 7 wants it extracted to a kernel package), `shared/response`, `golang-jwt/jwt/v5`, `google/uuid`.

## Forbidden Dependencies
- No domain service, no `storage`/sqlcgen, no `config`, no `httpapi`.
- Listed under depguard `cores-must-not-import-consumers` — must not import `ledger`, `notifications`, `verification`, `ops`, `reviews`, `media`.

## Contains
- `jwt.go` — `AuthedUser{ID, Role}`; `Signer` (holds `[]byte` secret + ttl + injectable clock). `NewSigner(secret, ttl)` / `NewSignerAt(secret, ttl, now)` (rejects secret < 32 bytes). `Issue(user)`; `Parse(token)` pins HS256 via `WithValidMethods([]string{"HS256"})` (rejects alg=none / RS256 confusion), validates exp/iat, requires UUID subject + `role.Valid()`. `ErrInvalidToken` covers every failure reason (one 401 regardless).
- `middleware.go` — `RequireAuth(next)`, `RequireRole(role, next)`, `UserFrom(ctx)`, all keyed on unexported `ctxKey{}`. `writeAuthError` sets `WWW-Authenticate: Bearer` and delegates to `response.Error`.

## Examples
```go
signer, _ := auth.NewSigner(cfg.JWTSecret, cfg.JWTTTL)
token, _ := signer.Issue(auth.AuthedUser{ID: userID, Role: identity.RoleCustomer})

// Compose middleware (RequireRole must sit INSIDE RequireAuth):
h := signer.RequireAuth(auth.RequireRole(identity.RoleAdmin, adminHandler))

// In a handler:
user, ok := auth.UserFrom(request.Context())
```
The huma transport re-implements the same rules in `httpapi/huma.go` (`authMiddleware`) rather than reusing `RequireAuth` directly — keep the two in sync.

## Best Practices
- Keep Parse errors vague to the caller; the specific failure only helps an attacker.
- Never trust a header for identity — read `AuthedUser` from the verified token via `UserFrom`.
- Secret comes from `config`/env, injected once in `cmd/api`; no package-level state.

## Common Mistakes
- Relaxing the HS256 pin (re-enabling alg negotiation) — reopens the classic JWT alg-confusion attack.
- Using `RequireRole` without wrapping `RequireAuth` first — it then denies everything.
- Reaching for a DB lookup during authorization — the role rides in the token by design.
