# apps/admin/src/features/dashboard

Scope: The Live Dashboard (`/live`, spec §6.5) and the Needs-Attention Feed (`/live/attention`, spec §6.6) — the console's landing screen and the prioritised queue that feeds it.

Purpose: Answer *"is everything okay, and if not, what needs me?"* in three seconds, then let the operator act on the worst item without leaving the queue. Designs: desktop artifact BOX 2–5 and 18–19; mobile artifact BOX 2–7 and 30–33.

Contents:

- `LiveDashboard.desktop.tsx` / `LiveDashboard.mobile.tsx` — the two dashboard shells (BOX 2/3/4/5/6/7).
- `NeedsAttentionFeed.desktop.tsx` / `NeedsAttentionFeed.mobile.tsx` — the full queue (BOX 18/19, BOX 30–33).
- `NeedsAttentionTable.desktop.tsx` + `needsAttentionColumns.tsx` — desktop's TABLE rendering.
- `NeedsAttentionCards.mobile.tsx` + `AttentionCard.tsx` — mobile's stacked-card rendering.
- `AttentionActions.tsx` — the two inline buttons a row offers; `AttentionFilters.tsx` — the counted chip row.
- `AlertBand.tsx`, `KpiTiles.tsx`, `ActivityTicker.tsx`, `ConnectionPill.tsx`, `AttentionEmptyStates.tsx`, `DashboardSkeletons.tsx`.
- `useLiveDashboard.ts`, `useNeedsAttention.ts`, `useAcknowledgeAlert.ts`, `useConnectionStatus.ts`, `usePriorityLabel.ts`.
- `dashboard.{api,mock,fixtures,types,constants}.ts`, `attention.fixtures.ts`.

Business logic:

- **One queue, two renderings.** Desktop renders a table and mobile renders cards, over the SAME `useNeedsAttention()` hook. That is the whole point of the wider canvas: an operator scans the AGE and PROVIDER columns down the page to find the worst problem, which stacked cards make impossible. Neither surface ever renders the other's shape.
- **Priority order, never chronological** (spec §6.6). The server sorts; `dashboard.mock.ts` reproduces the rule so the mock and the real endpoint behave alike. The feed states the ordering beneath the table because a queue that looks chronological and is not gets misread once and distrusted forever.
- **Trend colour is semantic, never directional.** A rising `Avg assign` is bad news, so its up-arrow chip is red. Under `docs/Booking-Workflow-Decisions.md` D3 that KPI measures the automation; a manual assignment is the anomaly worth noticing.
- **Acknowledge is the only mutation here** — `ADMIN_ACTIONS.acknowledgeAlert`: low risk, no step-up, no undo, audited. Assign / Reassign / Cancel / Re-dispatch belong to `features/booking-actions`; this feature only navigates to their routes through `ROUTES`.
- **Offline disables, never hides.** Every mutating affordance stays visible and disabled with a stated reason; a dropped-and-retrying socket only recolours the connection pill.

Dependencies: `components/ui/*`, `components/states/QueryBoundary`, `layouts/{Topbar,MobileAppBar}`, `lib/{format,permissions,toast,http}`, `routes/routes.constants`, `mocks/mockTransport`, `@sethu/i18n` (namespace `adminDashboard`).

Boundaries: no sibling-feature imports. Money, ages and percentages are formatted only through `lib/format`. The list components take rows as a plain array prop with no internal fetching or scroll ownership, so a windowing library can wrap either one unchanged (spec §2.4) — nothing is virtualised today because the queue's realistic ceiling is a few dozen rows.

Impacted modules: `pages/LiveDashboardPage.tsx`, `pages/NeedsAttentionPage.tsx`; `queries/useShellCounters` supplies the same "needs attention" count the sidebar badges.
