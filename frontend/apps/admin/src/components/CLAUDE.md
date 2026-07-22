# apps/admin/src/components

Scope: App-shared UI used by two or more features. Presentational and state-shaped components only.

Purpose: One configurable component per type, so a "new look" is a variant prop rather than a bespoke restyle (ENGINEERING-STANDARDS Part 6.2).

Contents:

- `ui/` — the design-system primitives. These are the ONLY files allowed to use the BEM class names in `../styles/components.css`.
- `ui/form/` — `Field` (label binding, required marker, `aria-describedby` wiring) plus the controls that sit in it. Every control is a real native input under the design's chrome.
- `ui/states/` — the §4.10 screen states that are not a plain empty: filtered-empty, not-found, permission-denied, coming-soon.
- `states/QueryBoundary.tsx` — the single switch between initial loading / error+retry / empty / filtered-empty / data. Use it on every data-driven section.
- `ErrorBoundary.tsx` — `RouteErrorBoundary`, the fatal-error state. Scoped per route so one screen throwing never takes the shell down.

Business logic: none. Anything with rules belongs in a feature or in `lib/`.

Dependencies: lucide-react (the icon set the design uses — stroke 1.5, 24px viewBox), `@sethu/i18n`, `../lib`.

Boundaries: no feature imports; no data fetching; no route knowledge except the states that offer a way back. Every primitive is ≤150 lines and single-responsibility. Colour never carries meaning alone — pills, dots and badges always ship a label or an `sr-only` equivalent (spec §4.8).

Impacted modules: every screen.
