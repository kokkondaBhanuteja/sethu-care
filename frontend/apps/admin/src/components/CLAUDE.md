# apps/admin/src/components

Scope: App-shared UI used by two or more features. Presentational and state-shaped components only.

Purpose: One configurable component per type, so a "new look" is a variant prop rather than a bespoke restyle (ENGINEERING-STANDARDS Part 6.2). Since the P3 redesign, the primitives are thin adapters over `@sethu/ui-web` wherever a global equivalent exists.

Contents:

- `ui/` — the design-system primitives, in two kinds:
  - **Adapters over `@sethu/ui-web`** (Button, Card, Pill→StatusPill, KpiTile, Tabs/Segmented via the exported variant maps, Avatar, Skeleton, EmptyState, SearchInput, Modal/Drawer/Sheet on Radix Dialog/Sheet, DataTable on the Table anatomy). Each PRESERVES the admin-side API — feature code imports are unchanged — and maps admin variants onto the global CVA variants plus token-utility overrides. Column config types for DataTable live in `data-table.types.ts`.
  - **Admin-only composites**, kept app-owned and styled on tokens: Timeline, StepRail, StepUpChallenge, StatusDot, Banner, RecordText, Badge, Panel, Spinner, Tooltip (ui-web has none yet), Pagination (deliberately count + "Load more", NOT the ui-web numbered pager), FilterBar (chip toggles; `filterChipClassName` is the exported chip look), ToastHost (admin toast system stays for now), Icon (the lucide wrapper).
- `ui/form/` — `Field` plus the controls that sit in it. Every control is a real native input under the design's chrome. Still on the legacy component layer.
- `ui/states/` — the §4.10 screen states that are not a plain empty: filtered-empty, not-found, permission-denied, coming-soon.
- `states/QueryBoundary.tsx` — the single switch between initial loading / error+retry / empty / filtered-empty / data.
- `ErrorBoundary.tsx` — `RouteErrorBoundary`, the fatal-error state.

Business logic: none. Anything with rules belongs in a feature or in `lib/`.

Dependencies: `@sethu/ui-web` (primitives + `cn` + exported variant maps), lucide-react (stroke 1.5), `@sethu/i18n`, `../lib`.

Boundaries: no feature imports; no data fetching; no route knowledge except the states that offer a way back. Every primitive is ≤150 lines and single-responsibility. Colour never carries meaning alone — pills, dots and badges always ship a label or an `sr-only` equivalent (spec §4.8). Adapters and composites may still use the (shrunken) class layer in `../styles/components.css`; a handful of UNSTYLED marker classes (`avatar`, `avatar__status`, `pill--striped` aside, `modal-scrim`, `scrim`) exist as stable structural hooks for tests.

Impacted modules: every screen.
