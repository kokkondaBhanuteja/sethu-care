# apps/admin/src/mocks

Scope: Shared plumbing and fixtures for the mock services that stand in for absent backend endpoints.

Purpose: Only six `/ops/*` endpoints exist today (`docs/admin-api-contract.md` lists everything still owed). Mocks let the whole console be built, reviewed and demoed now, and be swapped for real endpoints without touching a component.

Contents: `mockTransport.ts` — `mockRead` / `mockWrite` with realistic latency and the `VITE_MOCK_MODE` switches (`error`, `empty`, `slow`) that make every §4.10 state reachable in dev.

Business logic: none — latency and failure simulation only.

Dependencies: `../lib/env`, `../lib/http/apiError`.

Boundaries: **no component or page imports anything from here.** Mocks are reached only through a feature's `<feature>.api.ts`. Fixture data mirrors the approved designs (bookings `#B-8823`/`#B-8811`/`#B-8805`, providers Suresh Mehta / Ajay V., zones Kompally / Miyapur / Madhapur / Gachibowli) so a screen can be compared against its design tile directly.

Impacted modules: every feature's `.api.ts` until the backend catches up.
