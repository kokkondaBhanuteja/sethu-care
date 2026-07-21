# packages/core (@sethu/core)

Scope: Cross-app client-state kernel — session store, preferences store, and the persistence StorageAdapter.
Purpose: One session/token lifecycle for all apps: zustand stores + saveToken/loadToken/deleteToken behind a pluggable adapter (localStorage default; Capacitor secure adapter later via setStorageAdapter at app boot).
Contents: src/session/{store,storage}.ts, src/preferences/store.ts, src/index.ts.
Business logic: session status transitions; preference persistence.
Dependencies: zustand; react (peer).
Boundaries: no DOM-lib types (structural globalThis access); apps never call localStorage directly for tokens/preferences — always through this package; no server state here (that's TanStack Query).
Impacted modules: auth/session behaviour in all three SPAs; the future native secure-storage bridge plugs in here.
