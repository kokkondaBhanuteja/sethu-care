# internal/httpapi — CLAUDE.md

## Purpose
The TRANSPORT layer. Exposes the API as typed [huma v2](https://github.com/danielgtaylor/huma) operations mounted on the same `http.ServeMux` the rest of the app uses. huma generates the OpenAPI 3.1 contract from the Go types, and the mobile client is codegen'd from that spec — so a field or endpoint that isn't declared in these types cannot be called.

## Responsibilities
- Decode a typed input → call ONE domain service method → map any error via `classify` → return a typed output. Handlers are THIN.
- Bridge JWT auth + per-operation RBAC into huma (`authMiddleware`).
- Per-IP rate limiting (`RateLimit`), and the raw Razorpay webhook (`ServeHTTP`, HMAC on raw bytes).
- Be the single registration list (`RegisterAll`) shared by the server, tests, and `cmd/genopenapi`.

## Owns
none — the transport layer never writes tables directly.

## Allowed Dependencies
Domain services (`booking`, `ledger`, `catalog`, `identity`, `ops`, `address`, `reviews`, `verification`, `gateway`), `auth`, `money`, `flow`, adapters it hands off to (`media`, `razorpay`, `sms`). See `register.go` `Dependencies`.

## Forbidden Dependencies
- No direct DB / sqlcgen access, no `storage.InTx` — all persistence goes through a domain service.
- No business logic or status-code decisions outside `classify` (Phase 4 rule: domain owns validation + status selection).
- Domain/service packages must NOT import back into `httpapi` (holds; add explicit depguard rule per Phase 16).

## Contains
- `register.go` — `Dependencies` struct + `RegisterAll(api, deps)`: THE list of the API surface. `genopenapi` calls it with nil services (registration only reads input/output types).
- `huma.go` — `NewHumaAPI(mux, signer)`; `authMiddleware` (checks bearer scheme + `roleMetadataKey`, stashes `auth.AuthedUser` under unexported `humaUserKey`, 401/403); `toHumaError` → `classify` (≥500 logged + opaque); `bearerSecurity()`, `roleMetadata(role)`, `userFromContext`. `FieldsOptionalByDefault = true` (known wart — see Phase 11).
- `errors.go` — `classify(err) → (status, msg)`: THE ONE domain-error→HTTP mapper (400/401/403/404/409/422/429/500); delegates to `classifyAuth` (`auth.go`) first. `badRequestError` / `forbiddenError` are transport-raised.
- `ratelimit.go` — `RateLimit(control, limit, window, next)`: per-IP fixed-window via `flow.Allow`; exempts `/health` + `/webhooks/*`; fails open; 429 + `Retry-After`. `clientIP` prefers first `X-Forwarded-For` hop.
- `razorpay_webhook.go` — `RazorpayWebhookHandler`: raw handler, verifies HMAC on raw body, records to `gateway` inbox, captures via `ledger`, excluded from OpenAPI.
- Per-resource handlers: `bookings.go`, `catalog.go`, `addresses.go`, `ops.go`, `cash.go`, `payments.go`, `photos.go`, `location.go`, `auth.go` — each a `NewXHandler(...).RegisterHuma(api)`.
- `admin_*.go` — the admin console's contract (`AdminHandler`, frozen shapes; run `make openapi-check`, never regen-drift it). Phase 1 implemented: shell counters, dashboard summary/attention/activity (`ops` service), bookings list/detail (`booking.AdminList`/`AdminDetailByID` + `ledger.PaymentFactsForBooking` for the payment panel — the one deliberate two-service handler, since booking must not read the ledger), audit list (`audit.List`). Phase 2 implemented `admin_providers.go` + `admin_applications.go` over `providerops` (roster, profile, active jobs, suspend/block/force-offline/restore, application queue/review/approve/reject/request-documents). Everything else still 501s via `notImplemented`. `adminBookingReference` derives the operator reference (#B- + first 8 id hex digits).
- `admin_provider_support.go` — the provider family's mutation plumbing: `providerIdempotent` (Idempotency-Key replay via `flow.Recall/Remember`; deliberately best-effort — the version CAS and terminal-decision guards are the real double-action protection) and the two designed-conflict bodies (`providerVersionConflictBody`, `providerDecidedConflictBody`) which implement `huma.StatusError` by embedding the DECLARED body structs, so the runtime 409 JSON is exactly the contract's `staleVersionError`/`applicationDecidedError` shape. Helpers are provider-prefixed so sibling operation families can add their own without name collisions.

## Examples
```go
// A typed operation: decode typed input, one service call, classify, typed output.
func (handler *BookingHandler) create(ctx context.Context, in *CreateBookingInput) (*CreateBookingOutput, error) {
    user, _ := userFromContext(ctx)
    result, err := handler.booking.Create(ctx, user.ID, in.Body.toDomain())
    if err != nil {
        return nil, toHumaError(handler.log, err) // classify() picks the status
    }
    return &CreateBookingOutput{Body: toDTO(result)}, nil
}
// Guarding an op: declare bearer + role at the route.
huma.Register(api, huma.Operation{
    Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
}, handler.someAdminOp)
```

## Best Practices
- After ANY handler/type change run `make openapi` — the spec + client must stay in sync (CI drift-guards it).
- Add a new error mapping in `classify` ONCE; never branch on error type inside a handler.
- New endpoint → add it to `RegisterAll`, nowhere else.
- Keep auth vague: never reveal expired-vs-tampered.

## Common Mistakes
- Putting validation or DB access in a handler — it belongs in the service.
- Forgetting `bearerSecurity()`/`roleMetadata` on a protected op (then `userFromContext` returns `ok=false`).
- Adding a raw `net/http` handler when a typed huma op would do — raw handlers escape the OpenAPI contract (only the webhook legitimately does).
- Letting a domain error fall through to the `default` 500 branch in `classify` instead of mapping it.
