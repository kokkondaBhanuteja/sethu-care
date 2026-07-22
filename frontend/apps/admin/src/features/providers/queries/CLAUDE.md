# apps/admin/src/features/providers/queries

Scope: TanStack Query read hooks for the providers feature. Writes live in `../mutations`.

Purpose: One place that knows a query key, so an invalidation after a suspension or an approval hits every screen that shows the same record.

Contents:

- `providers.queries.ts` — roster (polled, because a stale live status is a wrong answer), profile, and the active-job list step 3 of the suspend flow blocks on.
- `applications.queries.ts` — applications queue and a single application review.

Business logic: none beyond refetch cadence. Query keys come from `../providers.constants.ts`; the data boundary is `../providers.api.ts`.

Dependencies: `@tanstack/react-query`, `../providers.api`, `../providers.constants`.

Boundaries: never import a `*.mock.ts` (the `.api.ts` chooses mock vs client), never call `fetch`, never render.

Impacted modules: every screen in this feature.
