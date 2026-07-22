# apps/admin/src/styles

Scope: The residual component layer of the legacy admin design system — CSS only. No TypeScript, no React.

Purpose: Style the admin-ONLY composites that the P3 migration kept app-owned (form controls, timeline, step rail, banners, toasts, map, viewer, mobile chrome, auth split). Everything with a `@sethu/ui-web` equivalent (buttons, cards, pills, tables, tabs, overlays, avatars, skeletons, empty states, sidebar, topbar…) was migrated to token-utility adapters in `components/ui/*` / `layouts/*`, and those class families were DELETED here — the file went from ~4.3k to ~1.9k lines with zero unconsumed selectors (verified by scanning every class name against the TS/TSX sources; base names that collide with English words were hand-verified with word-boundary greps).

Contents: `components.css` (the remaining BEM component classes, inside `@layer components`), `fonts.css` (GENERATED — do not hand-edit).

Business logic: none.

Dependencies: the tokens in `../index.css` — which since P3 layers the GENERATED global tokens (`@sethu/ui-web/tokens.css`) underneath and keeps only admin-specific names in its own `@theme`. The legacy alias block (`--canvas`, `--surface`, …) now resolves against the global values, so this layer moved to the new palette (gray canvas, white surfaces, 16px card radius) without editing its rules.

Boundaries: **only `components/ui/*` and `layouts/*` may use these class names.** Feature and page code composes the primitives plus Tailwind's token-backed utilities. Do not add a class here to style one screen — add a variant prop to the primitive instead. Before deleting a selector, prove it dead: grep the class name (word-boundary, not substring) across `src/**/*.{ts,tsx}` excluding this folder — and beware test fixtures and unstyled marker classes (`pill--striped` is real CSS; `modal-scrim`/`scrim`/`avatar`/`is-active`/`sidebar__group-header` are markers).

Impacted modules: the admin-only composites and both mobile/desktop shells' legacy chrome.
