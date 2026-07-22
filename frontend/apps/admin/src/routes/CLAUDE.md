# apps/admin/src/routes

Scope: The only place that maps URL ↔ page, and the only place a route string is written.

Purpose: Route table, guards, lazy page loading.

Contents:

- `routes.constants.ts` — `ROUTES` (typed path builders), `ROUTE_PATTERNS` (`:param` forms), `ROUTE_TABLE` (pattern + tab + surface + guarded action), `TABS`, `SURFACES`, `tabForPath()` (pathname → tab via the table; the mobile TabBar's single source of active-tab truth).
- `AppRoutes.tsx` — the route tree, every page lazy-loaded (route-level code splitting for the <2s cold-start budget).
- `RequireAuth.tsx` — unauthenticated → `/login`, carrying the attempted location so login resumes it (spec §3.4 rule 1).
- `RequirePermission.tsx` — page-level half of the permission model; the action-level half runs inside each mutation.
- `SurfaceGuard.tsx` — a `desktopOnly` route on a phone renders the "Best on desktop" notice (spec §6.34), never a blank screen or a 404. The notice wears the standard `MobileAppBar` (title + back chevron), so it starts with the screen's identity rather than mid-content.

Business logic: navigation policy and guard order (auth → permission → surface).

Dependencies: react-router, `../layouts`, `../pages`, `../lib/permissions`.

Boundaries: imports pages and layouts only. **No route string is ever written outside `routes.constants.ts`.** Source of truth is Admin spec §3.2 as amended by `docs/Booking-Workflow-Decisions.md` — there is no reschedule route, because D1 removed rescheduling from the product.

Impacted modules: every navigation affordance in both shells.
