# packages/tokens (@sethu/tokens)

Scope: Framework-agnostic design tokens (TS values) + the generator that turns them into the global
web CSS. No components, no React.
Purpose: THE single source of truth for every visual value. `src/web.ts` is the premium-ERP web
language (canvas/ink/tones/tints/accents/radii/shadows/type — Figma-reference derived);
`src/generate-css.ts` emits `packages/ui-web/src/styles/tokens.css` (Tailwind v4 `@theme`) — the
file every web app imports. This CLOSED the old "manual @theme mirror" recorded exception.
Contents: src/primitives.ts (brand ramp), src/semantic.ts (RN-era roles), **src/web.ts (web
language)**, src/generate-css.ts, src/index.ts (barrel).
Business logic: none — values + a pure emitter.
Dependencies: none at runtime (generator uses node:fs; runs via `node --experimental-strip-types`).
Boundaries: never import frameworks; token additions carry a one-line provenance comment; **never
edit the generated tokens.css by hand** — change web.ts and run
`pnpm --filter @sethu/tokens run generate:css` (CI drift-guards via `check:css`).
Impacted modules: every web surface at once — a web.ts change restyles admin, customer, provider
and landing on regeneration.
