# apps/admin/src/mocks

Scope: Shared plumbing and fixtures for the mock services that stand in for absent backend endpoints.

Purpose: Only six `/ops/*` endpoints exist today (`docs/admin-api-contract.md` lists everything still owed). Mocks let the whole console be built, reviewed and demoed now, and be swapped for real endpoints without touching a component.

Contents:

- `mockTransport.ts` — `mockRead` / `mockWrite` with realistic latency and the `VITE_MOCK_MODE` switches (`error`, `empty`, `slow`) that make every §4.10 state reachable in dev.
- `counterStore.ts` — shared mutable shell-badge counters, so acknowledging an alert actually drops the badge. `needsAttention` MUST equal the needs-attention queue's real row count (`features/dashboard/attention.fixtures.ts`, currently 5); a badge above the queue's own total reads as rows nobody can find. Kept as a literal because this folder sits below `features/` in the import graph — change it WITH the fixture list.
- `bookingStateStore.ts` — the counterStore pattern applied to booking state: a committed write mock records `recordBookingTransition(bookingId, { kind, at })` and the bookings read mocks project it (`features/bookings/bookings.projection.ts`), so a cancelled booking stops reading as escalated and moves segment. `clearBookingTransition` is the undo path; `resetBookingTransitions` serves tests. Dev-only URL trigger in the app's established mock-trigger style: `?mockWrite=<bookingId>:<assign|cancel|redispatch|manualComplete>`, comma-separable — renders any post-write state without driving the flow. Absent the param nothing changes, so every documented trigger id (B-8823 etc.) keeps its designed state.

Business logic: none — latency/failure simulation and shared mutable read-model state only.

Dependencies: `../lib/env`, `../lib/http/apiError`.

Boundaries: **no component or page imports anything from here.** Mocks are reached only through a feature's `<feature>.api.ts` (or its `.mock.ts`). This folder never imports from `features/`. Fixture data mirrors the approved designs (bookings `#B-8823`/`#B-8811`/`#B-8805`, providers Suresh Mehta / Ajay V., zones Kompally / Miyapur / Madhapur / Gachibowli) so a screen can be compared against its design tile directly.

Impacted modules: every feature's `.api.ts` until the backend catches up; the sidebar/tab badges (counterStore); the bookings list, tabs, summary and record (bookingStateStore).
