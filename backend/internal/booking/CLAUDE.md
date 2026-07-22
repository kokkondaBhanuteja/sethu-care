# internal/booking — CLAUDE.md

## Purpose
The core bounded context: the lifecycle of a job. `booking` is the source of truth for what has happened to a booking and the publisher of the events every other context reacts to (assignment, payment, OTP, notification, review all *listen* to booking — they do not live inside it).

## Responsibilities
- Own the pure state machine: 13 states × 13 actions in `state.go` + `statemachine.go`, with no default/fallthrough — a `(state, action)` pair absent from the table is illegal.
- `Create` a booking (order + booking DRAFT + item + `booking.created`) in one transaction.
- `Apply` a transition atomically: re-read → authorize (role + ownership) → optional Guard → pure decision → optimistic CAS → append `booking_events` → `audit.Record` → conditional outbox.
- Read models: `Get` (with `AllowedActions`), `ListForCustomer`, `ListForTechnician`; admin console reads in `admin.go`: `AdminList` (segment/state/zone/service/search filters, keyset cursor newest-created first, per-segment counts) and `AdminDetailByID` (full record + `booking_events` timeline). Like `ListForTechnician` these join users/services/addresses (+ the completed job's review) for display only.

## Owns
`bookings`, `booking_items`, `booking_events` (append-only). Also writes `orders` and `outbox` rows during `Create`/`Apply` (P0 seam: one-order-one-booking; order creation moves out in P3).

## Allowed Dependencies
`identity` (for `Role` only), `money`, `flow`, `audit`, `storage` (+`sqlcgen`), stdlib, `pgx`, `google/uuid`. The pure half (`state.go`, `statemachine.go`) may import **only** `fmt`/`errors` — enforced by depguard.

## Forbidden Dependencies
- `httpapi`/`huma`/`config` (never — it's a core, not transport).
- Any consumer: `ledger`, `notifications`, `ops`, `verification`, `reviews`, `media` — depguard `cores-must-not-import-consumers`. They listen to booking's events; booking never imports them.
- No DB/pgx/context in `state.go`/`statemachine.go` — if the machine "needs" a database to decide legality, the design has leaked.

## Contains
- `state.go` — `State`, `Action` enums (+`AllStates`/`AllActions`/`Valid`/`IsTerminal`/`String`).
- `statemachine.go` — the `transitions` table, pure `Apply(from, action)`, `AllowedActions`, `ParseState`; `IllegalTransitionError`, `UnknownStateError`.
- `permission.go` — `CanPerform(role, action)` (the role half of authz).
- `service.go` — `Service`, `NewService(pool, ...Option)`, `WithFlow`, `Create`, `Get`, `ListForCustomer`, `ListForTechnician`, `Apply`, `TransitionInput` (Actor/ActorRole/AssignTechnician/Guard/PaymentMethod). Errors: `ConflictError` (409), `ScheduleConflictError` (23P01→409), `ForbiddenError` (403), `ErrBookingNotFound`, `ErrVariant*`, `ErrInvalidQuantity`.
- `admin.go` — the console read models: `AdminList`/`AdminDetailByID`, `AdminSegment` (active/completed/cancelled — cancelled also holds FAILED), `AdminListInput`, `AdminPage`, `AdminDetail`, `ErrInvalidCursor` (→ 400). A non-empty search spans every segment; the cursor is base64("createdAtNanos|id") with a limit+1 peek so a full last page mints no cursor.

## Examples
```go
svc := booking.NewService(pool, booking.WithFlow(controller))
newState, err := svc.Apply(ctx, bookingID, booking.ActionVerifyStart, booking.TransitionInput{
    Actor:     &technicianID,
    ActorRole: identity.RoleTechnician,
    Guard:     verificationSvc.Guard(bookingID, verification.PurposeStart, code), // runs inside the tx
})
```

## Best Practices
- Every write goes through `storage.InTx`; the state change, its `booking_events` row, audit, and outbox commit together or not at all.
- Add a transition ONLY in the `transitions` table of `statemachine.go`. Add an action → also update `Valid()`, `CanPerform`, `publishedEventFor` (all `exhaustive`-linted) in the same PR.
- Authorize before the legality check, so an unauthorized caller can't probe what's legal.
- CAS on `version`; 0 rows ⇒ `ConflictError`. Never `SELECT ... UPDATE` without the version guard.

## Common Mistakes
- Defining a transition anywhere but `statemachine.go` (depguard blocks it).
- Importing pgx/context into the pure half.
- Booking a new action's event/authz without updating the exhaustive switches (build fails — that's the safety net working).
- Pricing a booking from client input: the total is computed in `Money` from the variant, never taken from the request.
