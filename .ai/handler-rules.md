# Handler Rules

## Purpose
Keep `internal/httpapi` a thin transport layer over huma. Grounded in review Phase 11/13 and
`internal/httpapi/*.go`.

## Rules
1. A handler does exactly four things: **decode typed input → call one service method → map error via
   `toHumaError`/`classify` → return typed output.** No business logic, no direct DB access.
2. Register operations with `huma.Register` and typed input/output structs; declare auth with
   `Security: bearerSecurity()` and the required role with `Metadata: roleMetadata(identity.Role…)`
   right at the route.
3. Take the caller identity from the token via `userFromContext(ctx)` — **never** accept a
   `customer_id`/actor from the request body (a client naming another user would impersonate them).
4. Map every error through `toHumaError(handler.log, err)`, which calls the single `classify()` in
   `internal/httpapi/errors.go`. Never choose a status code inline in a handler.
5. Transport-only failures use the transport error types (`badRequestError` → 400,
   `forbiddenError` → 403); domain errors are mapped by `classify`, not re-created here.
6. After ANY handler change run `make openapi` and commit the regenerated `api/openapi.yaml`
   (CI drift-guards it). This is contract-first: types → spec → mobile client.
7. Parse path/UUID inputs at the boundary (`parseUUID(input.ID, "id")`) and return a `badRequestError`
   on failure; deeper validation belongs in the service.
8. Known wart: huma is `FieldsOptionalByDefault = true` (`internal/httpapi/huma.go`), so every
   generated field is optional. Recommendation to adopt: mark **response** DTOs required-by-default
   (a coordinated breaking regen) — do not add new response fields assuming they're required today.

## Examples
- Thin handler with idempotency + single service call: `internal/httpapi/bookings.go` `create`
  (caller from `userFromContext`, `CustomerID: caller.ID`, one `bookings.Create`, `toHumaError`).
- Route-declared auth/role: `bookings.go` `RegisterHuma` (`Metadata: roleMetadata(identity.RoleCustomer)`).
- Single error mapper: `internal/httpapi/errors.go` `classify`; `huma.go` `toHumaError`.

## Anti-patterns
- Business rules, DB calls, or status-code selection inside a handler.
- Reading `customer_id`/actor from the request body instead of the JWT.
- Adding a per-handler error switch instead of extending `classify()`.
- Editing `api/openapi.yaml` by hand or forgetting `make openapi` after a handler change.

## Checklist
- [ ] Handler decodes typed input, calls one service method, maps via `toHumaError`, returns typed output.
- [ ] Auth/role declared at the route with `bearerSecurity()` + `roleMetadata`.
- [ ] Caller identity comes from `userFromContext`, not the body.
- [ ] No new status-code logic outside `classify()`.
- [ ] `make openapi` run; `api/openapi.yaml` committed.
