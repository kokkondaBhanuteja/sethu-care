# packages/domain (@sethu/domain)

Scope: Framework-free domain vocabulary — enums mirroring backend constants verbatim, branded IDs, pure helpers (money formatting).
Purpose: One shared vocabulary so no app compares against raw string literals; values stay in lockstep with backend/internal enums (drift-guarded server-side).
Contents: src/ enum/type modules + barrel.
Business logic: pure mappings only (e.g. state → allowed actions display logic); no I/O, no React.
Dependencies: none (pure leaf).
Boundaries: never import React/DOM/api-client; never invent values the backend doesn't have — new vocabulary lands backend-first, then here, same PR series.
Impacted modules: every feature that switches on states/roles/methods.
