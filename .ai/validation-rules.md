# Validation Rules

## Purpose
Draw the line between transport-shape checks and real domain validation, so validation lives where
the rule lives. Grounded in review Phase 11/13 and `internal/httpapi`, domain services.

## Rules
1. Keep huma/struct tags **minimal** — path `uuid`, `header:"Idempotency-Key"`, and shape only. Because
   `FieldsOptionalByDefault = true`, huma does not enforce requiredness; do not rely on it to validate.
2. Do **real validation in the domain service**, returning a typed error with the right status:
   `ErrInvalidQuantity` → 400, `ErrVariantInactive` → 422, `IllegalTransitionError` → 422,
   `ForbiddenError` → 403.
3. Parse enums/identifiers at the boundary with `ParseX`/`parseUUID`, converting a bad string into a
   clean domain error rather than letting it flow inward (`ParseEntryKind`, `ParsePaymentMethod`).
4. Validate the caller's authority as part of validation: role via `CanPerform`, then ownership inside
   the transaction (an unauthorized caller must not learn what would be legal).
5. Derive server-authoritative fields; never trust client-supplied identity or price. The customer is
   the token subject; the price comes from the catalog variant, not the request body.
6. Reject unrepresentable domain values loudly: `money.FromRupees` refuses sub-paise and overflow with
   `ErrSubPaise`/`ErrOverflow` instead of rounding silently.

## Examples
- Boundary UUID/enum parsing: `internal/httpapi/bookings.go` `parseUUID`; `ledger.ParseEntryKind`.
- Domain validation with typed errors: `internal/booking/service.go`
  (`ErrInvalidQuantity`, `ErrVariantInactive`).
- Money value validation: `internal/money/money.go` `FromRupees` (`ErrSubPaise`, `ErrOverflow`).
- Server-derived customer: `bookings.go` `create` uses `caller.ID`, not a body field.

## Anti-patterns
- Pushing business validation into huma tags and assuming huma enforces it (it doesn't, given
  optional-by-default).
- Accepting a client-supplied price, `customer_id`, or role.
- Silently coercing an invalid value (rounding sub-paise, defaulting an unknown enum) instead of
  returning a domain error.
- Duplicating a validation rule in both the handler and the service.

## Checklist
- [ ] Struct/huma tags cover shape only; real rules live in the service.
- [ ] Enums/UUIDs parsed at the boundary via `ParseX`/`parseUUID`.
- [ ] Each validation failure returns a typed error with the correct status.
- [ ] No client-supplied identity/price trusted; server derives them.
