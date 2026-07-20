# internal/shared/response — CLAUDE.md

## Purpose
Tiny JSON write helpers, shared by the transport layer and the health endpoint so there is exactly ONE place that sets the content type and encodes the body. Transport-only.

## Responsibilities
- Write a JSON body with a status code.
- Write a single-field JSON error body.

## Owns
none.

## Allowed Dependencies
stdlib (`encoding/json`, `net/http`, `log/slog`) only.

## Forbidden Dependencies
- No domain imports (Phase 7: shared transport helpers are transport-only). Kept dependency-free so `auth` and raw handlers can use it without pulling in a domain.

## Contains
- `JSON(writer, statusCode, payload any)` — sets `Content-Type: application/json`, writes the status, encodes payload. A failed encode is logged, not returned (the status line is already on the wire).
- `Error(writer, statusCode, message)` — writes `{"error": "..."}` via `JSON`.

## Examples
```go
response.JSON(writer, http.StatusOK, map[string]string{"status": "ok"}) // health
response.Error(writer, http.StatusUnauthorized, "invalid or expired token")
```
Used by `auth.writeAuthError` and the health/raw handlers. huma operations return typed outputs instead and do not need this.

## Best Practices
- Use for raw (non-huma) handlers only; typed huma operations return DTOs and let huma encode.
- Don't return the encode error — nothing useful can be done once the header is sent.

## Common Mistakes
- Importing a domain type here to shape a response — this package must stay domain-free.
- Reaching for it inside a huma operation instead of returning a typed output body.
