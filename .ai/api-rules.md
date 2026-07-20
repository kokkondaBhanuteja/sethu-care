# API Rules

## Purpose
Keep the HTTP surface consistent, contract-first, and safe to regenerate the mobile client from.
Grounded in review Phase 11 and `internal/httpapi`, `api/openapi.yaml`.

## Rules
1. **Contract-first, generated backwards-correctly:** Go handler types → `make openapi` →
   `api/openapi.yaml` → the mobile `packages/api-client`. The client cannot call an endpoint or read a
   field the Go types don't declare. Regenerate after every handler change; CI drift-guards it.
2. Name resources RESTfully: collections (`/bookings`, `/services`), sub-resources
   (`/bookings/{id}/transitions`, `/services/{id}/variants`), caller-scoped `/me/*`, admin `/ops/*`,
   `/webhooks/*`. Model a state change as `POST …/transitions` with an action, not a bespoke verb.
3. Use disciplined status codes mapped centrally in `classify()`: 201 on create, and
   400/401/403/404/409/422/429/500 as the domain error dictates.
4. Declare auth via the OpenAPI bearer scheme (`bearerSecurity()`) and per-op role
   (`roleMetadata(...)`); `authMiddleware` enforces both.
5. Extend `Idempotency-Key` to every non-idempotent POST that creates money or side effects (it exists
   on `POST /bookings` today; add it to payment capture/deposits — the flow layer already supports it).
6. Exempt `/health` and `/webhooks/*` from rate limiting; webhooks authenticate by signature instead
   (see `security-rules.md`).
7. Known/pending decisions (don't drift into them): `FieldsOptionalByDefault = true` should flip to
   required-by-default for **response** DTOs; adopt **cursor (keyset) pagination** for `/ops/*` lists
   before they grow; add a `/v1` prefix before any external consumer.

## Examples
- Operation registration with role + auth: `internal/httpapi/bookings.go` `RegisterHuma`.
- Idempotency-Key on create: `bookings.go` `create` (`input.IdempotencyKey`, flow `LockWait`/`Recall`).
- Central status mapping: `internal/httpapi/errors.go` `classify`.
- Rate-limit exemptions: `internal/httpapi/ratelimit.go` `exemptFromRateLimit`.

## Anti-patterns
- Editing `api/openapi.yaml` by hand instead of regenerating from types.
- A non-REST action verb endpoint where a `POST …/transitions` fits.
- Returning full unbounded slices for `/ops/*` queues (won't scale — use keyset pagination).
- A money-moving POST without an `Idempotency-Key` path.

## Checklist
- [ ] New/changed op has typed input+output and declared auth/role.
- [ ] `make openapi` run; `api/openapi.yaml` committed and drift-clean.
- [ ] Status codes flow from domain errors through `classify()`.
- [ ] Money-moving POSTs support `Idempotency-Key`.
- [ ] New list endpoints on `/ops/*` are paginated.
