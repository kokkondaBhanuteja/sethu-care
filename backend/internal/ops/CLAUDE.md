# internal/ops — CLAUDE.md

## Purpose
The operations console's back end: the manual-assignment queue and the commands ops runs against it. This is the P1 launch path — a human sees the queue and assigns a technician by hand. It owns NO aggregate; it reads across modules and commands them through their contracts.

## Responsibilities
- `Queue` — bookings awaiting a human assignment, oldest first.
- `Candidates(bookingID)` — technicians eligible for a booking, ranked by the §5.1 signals (city/skill/online/leave/capacity/shift, PostGIS distance, acceptance, rating).
- `Technicians` — the admin Employees view (status + current load), unfiltered.
- `Assign(bookingID, technicianID, adminID)` — verify the technician exists (clean 404), then command the `ASSIGN` transition as admin via `booking.Apply`.
- `StartSearch(bookingID)` — the auto-search consumer of `booking.confirmed`: moves CONFIRMED→SEARCHING as the system (nil actor) with admin authority; **idempotent** (already-moved / conflict / not-found ⇒ nil, so the outbox stops retrying).
- **Admin dashboard reads** (`dashboard.go`): `AttentionQueue(filter, limit, cursor)` — the needs-attention queue in the server-owned order (ESCALATED tier first, oldest surfaced first) with per-filter counts, healthy-job count and the last-cleared citation; `RecentActivity(limit)` — the last N transitions the console vocabulary can name; `SummaryForPeriod(today|live_now)` — KPIs (bookings, REVENUE, completion rate, SEARCHING→ASSIGNED latency) with same-window-yesterday deltas and 8-point sparklines. These are read-only cross-module views (bookings, booking_events, and the ledger's REVENUE rows at the SQL level — never the `ledger` Go package, never a write).

## Owns
None (cross-reads booking/identity/services/addresses; commands booking).

## Allowed Dependencies
`booking` (the command surface — a deliberate, documented coupling), `identity` (for `Role`), `money`, `storage/sqlcgen`, stdlib, `pgx`, `google/uuid`.

## Forbidden Dependencies
`httpapi`/`huma`/`config` and `ledger`. ops commands booking; it must not reach into another domain's tables.

## Contains
- `ops.go` — `Service`, `New(pool, *booking.Service)`; `QueueEntry`, `Candidate`, `Technician` view types; `ErrTechnicianNotFound`.
- `dashboard.go` — the admin dashboard read models: `AttentionQueue`/`RecentActivity`/`SummaryForPeriod`, their view types (`AttentionItem`, `ActivityEntry`, `DashboardSummary`, …) and `ErrInvalidCursor` (→ 400 in `classify`). Attention pagination is an opaque base64 keyset cursor over (tier, surfacedAt, id).
- `livemap.go` — `LiveMap(ctx, markerLimit)`: one snapshot of the admin live map. Technician positions from the migration-00014 columns, filtered to `PositionFreshnessWindow` (15m — an unvouchable pin is dropped, not shown stale); job pins on active bookings' addresses (EN_ROUTE/ARRIVED/IN_PROGRESS + ESCALATED); the SEARCHING/ESCALATED attention rail; CITY totals. Positions are PROJECTED server-side into percentages of a padded bounding box over the snapshot's own markers (the honest stand-in for a city box until a zones/tile model exists). Honest gaps documented in the file: no zones, no clustering, no delay state, viewport params unused.

## Examples
```go
ops := ops.New(pool, bookingSvc)
candidates, err := ops.Candidates(ctx, bookingID)      // ranked
state, err := ops.Assign(ctx, bookingID, techID, adminID) // ASSIGN via booking.Apply
// wired as the booking.confirmed outbox consumer:
err = ops.StartSearch(ctx, bookingID)                  // idempotent
```

## Best Practices
- Assignment goes through `booking.Apply` (full authz + state machine + CAS), never a direct write to `bookings`.
- Consumer methods (`StartSearch`) swallow already-moved / conflict / not-found as success so at-least-once delivery converges.
- Pre-check existence (`TechnicianExists`) to return a 404 instead of leaking a FK 500.

## Common Mistakes
- Writing to a booking, ledger, or identity table directly instead of commanding the owning service.
- Making `StartSearch` retry on a benign "already left CONFIRMED" outcome (it must return nil).
- Importing `ledger` (forbidden — ops is a command surface, not a money mover).
