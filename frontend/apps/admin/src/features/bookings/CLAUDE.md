# apps/admin/src/features/bookings

Scope: The bookings **list** (spec §6.8) and the booking **record view** (spec §6.9), in both shells.
Reading only. Every mutation — assign, cancel, re-dispatch, manual completion, refund — belongs to
`features/booking-actions`; this feature decides which of them a record's state and the operator's
permissions allow, and navigates to the route that owns it.

Purpose: find any booking fast, and answer "why is this one stuck?" without leaving the screen.

## Contents

| File                                          | Responsibility                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `bookings.constants.ts`                       | `BOOKING_STATES`, segments, the §4.3 state→pill mapping, `DETAIL_SECTION_CHIPS` (the record view's fixed icon-chip accents), query keys, page size |
| `bookings.types.ts`                           | List/detail shapes for `GET /ops/bookings` and `/ops/bookings/{id}`                   |
| `bookings.api.ts`                             | **The only data boundary.** Wraps the mock today, the generated client tomorrow       |
| `bookings.mock.ts` · `.seed.ts` · `.fixtures.ts` · `booking-detail.fixtures.ts` | Filtering/searching/paging + the artifact-accurate records |
| `useBookingsList.ts`                          | Segment, search, filters (`toggleState`/`replaceStates`), paging — shared by both list shells |
| `useBookingDetail.ts`                         | One record, plus the optimistic-concurrency and deep-link-intent rules                |
| `useBookingActions.ts`                        | State legality (§4.3, as amended) × `useCan` → the routes this record permits          |
| `useBookingCopy.ts`                           | Structured fragments → sentences, all inside `t()`                                    |
| `BookingsList.desktop.tsx`                    | The reference table-screen anatomy: ui-web `PageHeader` → `BookingsFilterBand` → `BookingsSummaryStrip` → table card + preview panel |
| `BookingsFilterBand.tsx`                      | ui-web `FilterBand`/`FilterField`: labelled search + state Select, reset on the baseline. Desktop only — mobile keeps the filter sheet |
| `BookingsSummaryStrip.tsx`                    | Per-segment counts as `KpiTile`s between the band and the table                       |
| `BookingsTableCard.tsx`                       | The queue as one ui-web Card: tabs in the header, inset-banded table, count + "Load more" in the card footer |
| `BookingsTable.tsx`                           | Columns, `TableColumnFilter` on STATE, and the trailing `TableActionLink` chevron to the record. Row click = preview; chevron = leave |
| `BookingsList.mobile.tsx`                     | Stacked cards + `BookingsFilterSheet` (mobile-only since the band landed)             |
| `BookingDetailScreen.tsx` → `.desktop/.mobile`| Not-found / error / loading switch, then the header-and-cards record                  |
| `BookingActionBar.tsx`                        | The record header's action bar: ≤2 outline secondaries, ONE filled primary, overflow into ui-web DropdownMenu. Acknowledge stays in the escalation card |
| `BookingSectionCard.tsx`                      | One icon-headed section card (soft `IconChip` + title + content) — `DETAIL_SECTION_CHIPS` fixes each section's glyph and accent |
| `RecordText.tsx`                              | `MonoText`, `RecordSection`, `MatchHighlight` — feature-local text treatments (`RecordSection` now only labels the preview panel) |
| `*.test.tsx`                                  | Band labelling, table filter/chevron/selection semantics, action-bar budget + inert rule |

## Business logic

- **Three segments, never four.** "Scheduled" is removed: nothing is future-dated
  (`docs/Booking-Workflow-Decisions.md` D1). Admin still sees Cancelled, which also holds `FAILED`.
- **Assign only from `ESCALATED` or `FAILED`.** Dispatch is automated; admin assign is a rescue
  tool, not routine. The artifacts' "Reassign" button on a healthy booking is deliberately not
  reproduced.
- **No reschedule anywhere.** There is no route and no action.
- **The timeline is the point.** Each auto-dispatch round is an entry, carrying round number,
  radius and decline count. That is the "why did this fail" diagnostic — kept verbatim inside the
  Timeline section card.
- **Optimistic concurrency.** A record carries `version`; a stale one returns 409. When the record
  reports a concurrent change, every write path on the screen goes inert *together* (header action
  bar, section-card affordances, sticky bar) and the banner offers Reload. The screen never swaps
  itself to the new data under the operator's thumb.
- **Deep-link rule (spec §3.4 rule 4).** An action route that finds its booking already resolved
  should send the operator to `ROUTES.bookingDetail(id)` with `?intent=<actionId>`; the detail then
  opens with the informational banner instead of the action sheet.
- **Search** is debounced 300 ms and fires from three characters, spans every segment, and matches
  the id with or without `#B-` and the phone with or without `+91`.
- **Filter model:** the band's Select is quick single-state narrowing, the STATE column's caret
  filter is where multi-state selections live; both write through `replaceStates`, and one Clear
  resets everything. The escalation notice is a tinted danger ui-web Card (`role="alert"`), not a
  full-bleed strip.

## Dependencies

`@sethu/ui-web` (PageHeader, FilterBand/FilterField, Card anatomy, IconChip, TableColumnFilter,
TableActionLink, DropdownMenu, Select, SearchInput, KpiTile via the adapter), `components/ui/*`,
`components/states/QueryBoundary`, `layouts/{Topbar,MobileAppBar,PageMain,Layout}`,
`lib/{format,http,permissions}`, `hooks/{useDebouncedValue,useConnectionStatus}`,
`routes/routes.constants`, `mocks/mockTransport`, `@sethu/i18n` (namespace `adminBookings`).

## Known gaps (flagged to the orchestrator, not worked around)

- `Topbar` always emits an h1 (visible from `title`, sr-only from `crumbs`), so a screen that also
  renders ui-web `PageHeader` carries a duplicate heading (same text, one sr-only). Needs a
  chrome-only Topbar variant owned by `layouts/`.
- `Tabs` cannot carry the pulsing danger dot the design puts on Active when it holds an escalation
  (`counts.activeHasEscalation` is already in the payload, waiting for it).
- i18n wording gaps (locales are not this feature's to edit): a "Show all"/"All states" label for
  the band's reset and Select placeholder, a short "View" cell label (the chevron link reuses
  `detail.openFull` as its accessible name), and date/area band filters — the latter also need API
  support before they can be real controls.

## Boundaries

- No sibling-feature imports. Booking mutations are navigated to, never performed here.
- No BEM class from `styles/components.css`; only token-backed Tailwind utilities and primitives.
- `BOOKING_STATES` mirrors `backend/internal/booking/state.go` verbatim. Delete it and re-export the
  generated vocabulary the moment `@sethu/api-client` types `state` as an enum.
- Mobile is never the desktop table squeezed: two components over one `useBookingsList()` hook.

## Impacted modules

`pages/BookingsListPage.tsx`, `pages/BookingDetailPage.tsx`, and every screen that deep-links into a
booking (alerts, needs-attention, live dashboard, customer profile).
