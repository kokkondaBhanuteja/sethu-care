# packages/tokens (@sethu/tokens)

Scope: Framework-agnostic design tokens (TS values: primitives + semantic). No components, no CSS, no React.
Purpose: One source of truth for brand color/spacing/type values consumed by every app's Tailwind @theme block (manual mirror today — recorded exception, ENGINEERING-STANDARDS.md §6.2) and by JS that needs raw values.
Contents: src/primitives.ts, src/semantic.ts, src/index.ts (barrel).
Business logic: none.
Dependencies: none (pure leaf).
Boundaries: never import anything; never add framework-specific code. Token additions include a one-line provenance comment.
Impacted modules: every app's visual layer; changing a semantic token reskins all surfaces.
