# internal/catalog — CLAUDE.md

## Purpose
Owns the HSOS service tree: categories, skills, services, priced variants, and the dynamic questions asked at booking time. Adding a service is an INSERT, never a deploy.

## Responsibilities
- Public reads: `ListCategories`, `ListServices` (services + active variants, assembled from two queries), `GetService` (variants + booking-time questions).
- Admin writes: `CreateCategory`, `CreateService`, `CreateVariant`.
- Validate `AssignmentMode` and non-negative prices before hitting the DB; translate FK violations (23503) into `ErrCategoryNotFound`/`ErrServiceNotFound`.

## Owns
`categories`, `skills`, `services`, `service_variants`, `question_defs`, `product_*`.

## Allowed Dependencies
`money`, `storage` (+`sqlcgen`), stdlib, `pgx`, `google/uuid`.

## Forbidden Dependencies
Any consumer (`ledger`/`notifications`/`ops`/`verification`/`reviews`/`media`) and `httpapi`/`huma`/`config`. `catalog` is a **core** — depguard `cores-must-not-import-consumers`.

## Contains
- `catalog.go` — the application service is named `Catalog` (the domain noun `Service` is a bookable service, so `catalog.Service` would collide). `New(pool)`; `Category`/`Service`/`Variant`/`Question` types; reads and writes above; `ErrServiceNotFound`, `ErrCategoryNotFound`.
- `enums.go` — `AssignmentMode` (AUTO/MANUAL) and `QuestionKind` (TEXT/SINGLE_CHOICE/PHOTO, with `RequiresOptions`). Full enum pattern + DB CHECK + drift test.

## Examples
```go
cat := catalog.New(pool)
svc, err := cat.CreateService(ctx, catalog.NewService{
    CategoryID: categoryID, Name: "AC Service", Slug: "ac-service",
    AssignmentMode: catalog.AssignmentAuto, EstimatedMinutes: 60,
}) // FK miss → ErrCategoryNotFound
services, err := cat.ListServices(ctx) // active services + their active variants
```

## Best Practices
- Add an enum value together with its DB CHECK and the drift-test entry, in one PR.
- `ParseAssignmentMode`/`ParseQuestionKind` are the only places a raw DB string becomes a typed enum — never cast directly.
- AUTO vs MANUAL is a property of the SERVICE (repairs auto-dispatch; delivery/installation are assigned by hand) — changing it is an UPDATE, not a code change.

## Common Mistakes
- Referring to the service type as `catalog.Service` when you mean the application service (it's `catalog.Catalog`).
- Importing a consumer package for a shared type (catalog is a leaf-ward core).
- A SINGLE_CHOICE question with no options — both `RequiresOptions` and a DB CHECK reject it.
