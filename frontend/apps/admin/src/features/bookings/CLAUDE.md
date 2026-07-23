# apps/admin/src/features/bookings

Scope: The bookings **list** (spec §6.8) and the booking **record view** (spec §6.9), in both shells.
Reading only. Every mutation — assign, cancel, re-dispatch, manual completion, refund — belongs to
`features/booking-actions`; this feature decides which of them a record's state and the operator's
permissions allow, and navigates to the route that owns it.

Purpose: find any booking fast, and answer "why is this one stuck?" without leaving the screen.

## Contents

| File                                          | Responsibility                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `bookings.constants.ts`                       | `BOOKING_STATES`, segments, the §4.3 state→pill mapping, `DETAIL_SECTION_CHIPS`, `UNASSIGNED_FILTER_STATES`, query keys, page size |
| `bookings.types.ts`                           | List/detail shapes for `GET /ops/bookings` and `/ops/bookings/{id}`, incl. `BookingsSummary` (the stat-strip figures) |
| `bookings.api.ts`                             | **The only data boundary.** Mock branch when `env.useMocks` (unchanged for tests/e2e); otherwise the REAL `GET /ops/bookings` and `/ops/bookings/{id}` through the generated client |
| `bookings.api.map.ts`                         | Pure real-payload mappers onto `bookings.types.ts`: query params (`q`/`state` omitted when empty, limit capped at the server's 100), `round`→`number`, payment method code→label, and `deriveBookingsSummary` — the stat strip is derived from the fetched rows because the endpoint carries no `summary` field yet (contract gap, flagged) |
| `bookings.mock.ts` · `.seed.ts` · `.fixtures.ts` · `booking-detail.fixtures.ts` | Filtering/searching/paging + the artifact-accurate records. Counts and the summary are computed from the projected pool, so a committed write moves a row between tabs |
| `bookings.projection.ts`                      | Maps committed mock writes (`mocks/bookingStateStore`) onto the read shapes — state, escalation cleared, timeline entry, version bump. Mock plumbing only |
| `useBookingsList.ts`                          | Segment, search, filters (`toggleState`/`replaceStates`), paging — shared by both list shells. List refetches on mount so a returning action flow shows its write |
| `useBookingDetail.ts`                         | One record (refetch-on-mount for the same reason), plus the optimistic-concurrency and deep-link-intent rules |
| `useBookingActions.ts`                        | State legality (§4.3, as amended) × `useCan` → the routes this record permits          |
| `useBookingCopy.ts`                           | Structured fragments → sentences, all inside `t()`                                    |
| `useBookingsListLayout.ts`                    | `useHasSidePreview()` — ≥1280px (Tailwind xl): permanent preview column; below: drawer |
| `BookingsList.desktop.tsx`                    | The reference table-screen anatomy: ui-web `PageHeader` → `BookingsFilterBand` → `BookingsSummaryStrip` → table card, beside `BookingPreviewPanel` at ≥1280px or over `BookingPreviewDrawer` below |
| `BookingsFilterBand.tsx`                      | ui-web `FilterBand`/`FilterField` on a 4-col grid from `md`, so search + state + Clear share one baseline at every desktop width. Select placeholder is "All states", never the field label again |
| `BookingsSummaryStrip.tsx`                    | Three clickable `KpiTile` drill-downs: Escalated count, oldest unassigned age, completed today — deliberately NOT the tab counts, which the tabs already carry |
| `BookingsTableCard.tsx`                       | The queue as one ui-web Card: tabs in the header, inset-banded table, count + "Load more" in the card footer |
| `BookingsTable.tsx`                           | The audited column budget: BOOKING (time sub-line), STATE (+`TableColumnFilter`), SERVICE (area sub-line), CUSTOMER, PHONE (search only), PROVIDER, then the `TableActionLink` chevron **sticky right** so the exit affordance survives any residual scroll. `tight` cell padding keeps the minimum width inside the card at 1280. Row click = preview; chevron = leave |
| `BookingPreviewContent.tsx`                   | The preview body + skeleton, shared verbatim by panel and drawer. Unassigned provider card says only "Not assigned" — the danger card and the attempts rail carry the diagnostic |
| `BookingPreviewPanel.tsx` / `BookingPreviewDrawer.tsx` / `BookingPreviewActions.tsx` | The two preview surfaces over one content block, and their shared one-decision footer |
| `BookingsList.mobile.tsx`                     | Stacked cards + `BookingsFilterSheet`; the filter trigger carries the applied-count Badge |
| `BookingsFilterSheet.tsx`                     | Mobile state chips at the 44px tap floor (`h-11` over `filterChipClassName`), under a visible "Booking state" caption |
| `BookingDetailScreen.tsx` → `.desktop/.mobile`| Not-found / error / loading switch, then the header-and-cards record. Mobile renders the banner stack INSIDE `MobileScroll` — pinned, the escalation strip ate a quarter of a 390px viewport |
| `BookingActionBar.tsx`                        | The record header's action bar: ≤2 outline secondaries, ONE filled primary, overflow into ui-web DropdownMenu |
| `BookingDetailBannerStack.tsx` / `BookingDetailBanners.tsx` | The stacked persistent conditions. The escalation banner carries ONLY Acknowledge (the header/sticky bar owns Assign); at mobile widths its actions stack full-width under the message |
| `BookingSectionCard.tsx`                      | One icon-headed section card (soft `IconChip` + title + content)                       |
| `RecordText.tsx`                              | `MonoText`, `RecordSection`, `MatchHighlight` — feature-local text treatments          |
| `*.test.tsx` · `bookings.projection.test.ts`  | Band labelling, table filter/chevron/selection semantics, action-bar budget + inert rule, summary-tile drill-downs, write-projection + undo + dev-trigger parsing |

## Business logic

- **Three segments, never four.** "Scheduled" is removed: nothing is future-dated
  (`docs/Booking-Workflow-Decisions.md` D1). Admin still sees Cancelled, which also holds `FAILED`.
- **RESCHEDULED is offered nowhere.** D1 deleted rescheduling, so the state sits in no segment and
  no filter option — `BOOKING_STATES` keeps the constant only because it mirrors
  `backend/internal/booking/state.go` verbatim.
- **Assign only from `ESCALATED` or `FAILED`.** Dispatch is automated; admin assign is a rescue
  tool, not routine.
- **The timeline is the point.** Each auto-dispatch round is an entry, carrying round number,
  radius and decline count — and it is stated ONCE per surface: escalation banner + timeline keep
  it, provider cards say only "Not assigned".
- **One filled primary per screen.** The header action bar (desktop) or sticky bar (mobile) owns
  Assign; the escalation banner owns Acknowledge and nothing else.
- **Optimistic concurrency.** A record carries `version`; a stale one returns 409. When the record
  reports a concurrent change, every write path on the screen goes inert *together* and the banner
  offers Reload. The screen never swaps itself to the new data under the operator's thumb.
- **Deep-link rule (spec §3.4 rule 4).** An action route that finds its booking already resolved
  sends the operator to `ROUTES.bookingDetail(id)` with `?intent=<actionId>`.
- **Search** is debounced 300 ms and fires from three characters, spans every segment, and matches
  the id with or without `#B-` and the phone with or without `+91`.
- **Filter model:** the band's Select is quick single-state narrowing, the STATE column's caret
  filter is where multi-state selections live (checked state wired via `TableColumnFilter`); both
  write through `replaceStates`, one Clear resets everything, and the summary tiles are shortcuts
  onto the same model.
- **Write projection (mock-era).** Reads run through `bookings.projection.ts` over
  `mocks/bookingStateStore`, so a committed cancel/assign/etc. changes the list row, the tabs'
  counts and the record — instead of the fixture forever re-offering the action just taken. Dev
  trigger: `?mockWrite=B-8823:cancel` (comma-separable) renders any post-write state directly.

## Dependencies

`@sethu/ui-web` (PageHeader, FilterBand/FilterField, Card anatomy, IconChip, KpiTile — used
directly for its `onClick` drill-down form, TableColumnFilter, TableActionLink, DropdownMenu,
Select, SearchInput, cn), `components/ui/*` (incl. Drawer and `filterChipClassName`),
`components/states/QueryBoundary`, `layouts/{Topbar,MobileAppBar,PageMain,Layout}`,
`lib/{format,http,permissions}`, `hooks/{useDebouncedValue,useConnectionStatus}`,
`routes/routes.constants`, `mocks/{mockTransport,bookingStateStore}`, `@sethu/i18n`
(namespace `adminBookings`).

## Known gaps (flagged to the orchestrator, not worked around)

- `Tabs` cannot carry the pulsing danger dot the design puts on Active when it holds an escalation
  (`counts.activeHasEscalation` is already in the payload, waiting for it).
- `FilterBar` has no touch-size chip variant; the sheet overrides `h-11` locally. Promote a `size`
  prop when a second touch consumer appears.
- Date/area band filters need API support before they can be real controls.

## Boundaries

- No sibling-feature imports. Booking mutations are navigated to, never performed here.
- No BEM class from `styles/components.css`; only token-backed Tailwind utilities and primitives.
- `BOOKING_STATES` mirrors `backend/internal/booking/state.go` verbatim. Delete it and re-export the
  generated vocabulary the moment `@sethu/api-client` types `state` as an enum.
- Mobile is never the desktop table squeezed: two components over one `useBookingsList()` hook.
- `bookings.projection.ts` is called only from `bookings.mock.ts` and dies with it.

## Impacted modules

`pages/BookingsListPage.tsx`, `pages/BookingDetailPage.tsx`, every screen that deep-links into a
booking (alerts, needs-attention, live dashboard, customer profile), and — through the projected
counts — anything reading `BookingsPage.counts`/`summary`.
