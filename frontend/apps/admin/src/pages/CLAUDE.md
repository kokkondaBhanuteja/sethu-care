# apps/admin/src/pages

Scope: Route targets. One default-exported component per route in `routes/routes.constants.ts`.

Purpose: Pages WIRE, they do not implement — read route params, compose feature components, choose the desktop or mobile variant.

Contents: one file per route (see `routes/AppRoutes.tsx` for the mapping).

Business logic: none. If a page grows logic, it belongs in the feature's `use<Screen>()` hook.

Dependencies: `../features/*`, `../layouts`, `../components`.

Boundaries: pages never call the API client directly and never import a `*.mock.ts` — they go through a feature's query or mutation hook. Keep every page thin; the 150-line cap should never be close.

Impacted modules: `routes/AppRoutes.tsx` imports every file here lazily.
