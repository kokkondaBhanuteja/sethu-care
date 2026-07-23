# apps/admin/src/queries

Scope: App-shared TanStack Query read hooks — cross-feature only. Feature-specific reads live in the feature.

Purpose: Data both shells need, which therefore belongs to neither feature (Part 3.2's promote-upward rule).

Contents: `useShellCounters.ts` (navigation badge counts), `shell.api.ts` (the boundary — real `GET /ops/shell-counters` via the generated client when `env.useMocks` is false, the mock otherwise), `shell.mock.ts`, `shell.types.ts`.

Business logic: badge counters fail silently to zero — a badge that cannot load must not push an error state into the chrome, because the shell has to stay usable so the operator can navigate to whatever is broken.

Dependencies: `@sethu/api-client`, `@tanstack/react-query`, `../lib/{env,http}`, `../mocks`.

Boundaries: components never import a `*.mock.ts` or `*.api.ts` directly — always the hook. Server state lives here, never in zustand.

Impacted modules: `Sidebar`, `TabBar`, `Topbar`.
