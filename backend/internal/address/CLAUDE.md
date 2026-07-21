# internal/address — CLAUDE.md

## Purpose
Owns customer addresses, including the PostGIS geography point dispatch later measures distance against.

## Responsibilities
- `Create` — save an address. The FIRST address a customer saves becomes their default automatically; setting a new default clears the old one in the SAME transaction, so the partial-unique index (one default per user) is never violated. Validates lat/lng range up front and maps the pincode CHECK violation to a clean error.
- `List` — a customer's addresses, default first.

## Owns
`addresses`.

## Allowed Dependencies
`storage` (+`sqlcgen`), stdlib, `pgx`, `google/uuid`.

## Forbidden Dependencies
Any consumer and `httpapi`/`huma`/`config`. `address` is a **core** (depguard `cores-must-not-import-consumers`).

## Contains
- `address.go` — `Service`, `New(pool)`; `NewAddress` (create input), `Address`; `Create`, `List`; errors `ErrInvalidCoordinates` (lat∈[-90,90], lng∈[-180,180]) and `ErrInvalidAddress` (DB-caught, e.g. the 6-digit pincode CHECK).

## Examples
```go
addr := address.New(pool)
saved, err := addr.Create(ctx, address.NewAddress{
    UserID: customerID, Label: "Home", Line1: "...", City: "Hyderabad",
    Pincode: "500081", Lat: 17.44, Lng: 78.39, // first address → auto-default
})
list, err := addr.List(ctx, customerID) // default first
```

## Best Practices
- Validate coordinate range in Go before the DB; let the DB CHECK own pincode format.
- The default-swap (clear old, set new) is one `storage.InTx` — never two calls that could leave zero or two defaults.
- Lat/lng come from device GPS; text→coordinate geocoding is a later slice (the Geocoder port), not this package's job.

## Common Mistakes
- Setting a new default without clearing the old one in the same transaction (violates the partial-unique index).
- Skipping the range check and relying on the DB alone for a 4xx (`ErrInvalidCoordinates` is the pre-check).
