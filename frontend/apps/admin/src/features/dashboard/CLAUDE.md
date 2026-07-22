# apps/admin/src/features/dashboard

Scope: The Live Dashboard (`/live`, spec §6.5) and the Needs-Attention Feed (`/live/attention`, spec §6.6) — the console's landing screen and the prioritised queue that feeds it.

Purpose: Answer *"is everything okay, and if not, what needs me?"* in three seconds, then let the operator act on the worst item without leaving the queue. Designs: desktop artifact BOX 2–5 and 18–19; mobile artifact BOX 2–7 and 30–33, restyled to the approved premium ui-web language (white cards on canvas, icon chips, semantic colour only in pills/chips/trends and the alert card).

Contents:

- `LiveDashboard.desktop.tsx` / `LiveDashboard.mobile.tsx` — the two dashboard shells. Desktop: period switch + ConnectionPill as Topbar page actions, then PageMain (ui-web PageShell rhythm) holding the alert card, the KPI strip and the two section cards side by side (`xl:grid-cols-3`). Mobile: app bar and alert card outside `MobileScroll` (the band can never scroll away), then the same sections stacked.
- `NeedsAttentionFeed.desktop.tsx` / `NeedsAttentionFeed.mobile.tsx` — the full queue. Desktop is one composed Card: counted filter chips as the header band, the DataTable under its inset column headers, the priority-order note as the CardFooter. Mobile keeps filters + stacked cards.
- `NeedsAttentionTable.desktop.tsx` + `needsAttentionColumns.tsx` — desktop's TABLE rendering.
- `NeedsAttentionCards.mobile.tsx` + `AttentionCard.tsx` — mobile's stacked-card rendering.
- `DashboardSectionCard.tsx` — the dashboard grouping surface both shells share: ui-web Card + icon CardHeader (soft IconChip — amber TriangleAlert for the queue, brand Activity for the ticker), one h2, per-card actions ("View all" outline link-button, refresh ghost icon-button). `flush` lets a table run edge-to-edge.
- `KpiTiles.tsx` — the four KPIs on ui-web `KpiTile` DIRECTLY (the admin `components/ui/KpiTile` adapter has no icon/accent passthrough): vivid solid chips (bookings=blue ClipboardList, revenue=green Wallet, completion=purple ShieldCheck, avg-assign=amber Timer), text-kpi numbers, semantic trend line with the sr wording "up 40s, worse". Responsive `grid-cols-2 lg:grid-cols-4`. Sparklines were dropped from the strip in the redesign (data still arrives in `DashboardSummary`).
- `AttentionActions.tsx` — the two inline buttons a row offers; `AttentionFilters.tsx` — the counted chip row (shared look via `components/ui/FilterBar`'s `filterChipClassName`).
- `AlertBand.tsx` — the escalation band as the tinted danger feature Card (tone danger, solid red BellRing chip, count headline, two example lines, View all) — prominent but composed, never a raw full-width bar. Desktop renders it as the first PageMain section; mobile as a whole-card Link pinned above the scroll region.
- `ActivityTicker.tsx`, `ConnectionPill.tsx`, `AttentionEmptyStates.tsx`, `DashboardSkeletons.tsx` (KpiSkeleton mirrors the responsive KPI grid).
- `useLiveDashboard.ts`, `useNeedsAttention.ts`, `useAcknowledgeAlert.ts`, `useConnectionStatus.ts`, `usePriorityLabel.ts`.
- `dashboard.{api,mock,fixtures,types,constants}.ts`, `attention.fixtures.ts`.
- Tests: `KpiTiles.test.tsx` (trend words + semantic colour + chips + grid), `AlertBand.test.tsx` (healthy-day absence, count cap, alert role, links), `DashboardSectionCard.test.tsx` (h2 + chip + actions anatomy).

Business logic:

- **One queue, two renderings.** Desktop renders a table and mobile renders cards, over the SAME `useNeedsAttention()` hook. That is the whole point of the wider canvas: an operator scans the AGE and PROVIDER columns down the page to find the worst problem, which stacked cards make impossible. Neither surface ever renders the other's shape.
- **Priority order, never chronological** (spec §6.6). The server sorts; `dashboard.mock.ts` reproduces the rule so the mock and the real endpoint behave alike. The feed states the ordering in its card footer because a queue that looks chronological and is not gets misread once and distrusted forever.
- **Trend colour is semantic, never directional.** A rising `Avg assign` is bad news, so its up-arrow line is red. Under `docs/Booking-Workflow-Decisions.md` D3 that KPI measures the automation; a manual assignment is the anomaly worth noticing.
- **Colour discipline.** Semantic colour appears only in pills/chips/trend lines, the reason cell (the diagnosis) and the danger alert card; everything else is ink/muted/faint on white.
- **Acknowledge is the only mutation here** — `ADMIN_ACTIONS.acknowledgeAlert`: low risk, no step-up, no undo, audited. Assign / Reassign / Cancel / Re-dispatch belong to `features/booking-actions`; this feature only navigates to their routes through `ROUTES`.
- **Offline disables, never hides.** Every mutating affordance stays visible and disabled with a stated reason; a dropped-and-retrying socket only recolours the connection pill.

Dependencies: `@sethu/ui-web` (Card anatomy, KpiTile, IconChip, Button/buttonVariants, cn), `components/ui/*`, `components/states/QueryBoundary`, `layouts/{Topbar,MobileAppBar,PageMain}` (PageMain/MobileScroll are the scroll regions), `lib/{format,permissions,toast,http}`, `routes/routes.constants`, `mocks/mockTransport`, `@sethu/i18n` (namespace `adminDashboard`).

Boundaries: no sibling-feature imports; no BEM class from `styles/components.css` (the shells reach scroll regions only through `PageMain`/`MobileScroll`). Money, ages and percentages are formatted only through `lib/format`. Inside ui-web slots (IconChip, Button) lucide glyphs are passed raw — the primitive owns the geometry; elsewhere icons go through `components/ui/Icon`. The list components take rows as a plain array prop with no internal fetching or scroll ownership, so a windowing library can wrap either one unchanged (spec §2.4).

Impacted modules: `pages/LiveDashboardPage.tsx`, `pages/NeedsAttentionPage.tsx`; `queries/useShellCounters` supplies the same "needs attention" count the sidebar badges.
