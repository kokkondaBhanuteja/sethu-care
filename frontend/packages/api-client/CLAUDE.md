# packages/api-client (@sethu/api-client)

Scope: The typed HTTP client GENERATED from backend/api/openapi.yaml via @hey-api/openapi-ts. src/generated/** is machine-owned.
Purpose: The only HTTP layer — apps call generated SDK functions through feature .api.ts wrappers; configureApiClient({ baseUrl, getToken }) wires base URL + bearer token once per app.
Contents: openapi-ts.config.ts (input: ../../../backend/api/openapi.yaml), src/index.ts (configureApiClient + public re-exports), src/generated/ (NEVER hand-edited).
Business logic: none — transport only.
Dependencies: the generated fetch client (self-contained).
Boundaries: NEVER hand-edit src/generated (CI drift guard enforces); contract changes start in the Go backend → make openapi → pnpm api:generate, same PR. Apps must not import generated internals beyond the package exports.
Impacted modules: every data call in every app; regenerating after a breaking backend change ripples type errors outward (that's the point).
