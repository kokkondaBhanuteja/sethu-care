# apps/admin/src/features/bookings

Scope: The bookings **list** (spec §6.8) and the booking **record view** (spec §6.9), in both shells.
Reading only. Every mutation — assign, cancel, re-dispatch, manual completion, refund — belongs to
`features/booking-actions`; this feature decides which of them a record's state and the operator's
permissions allow, and navigates to the route that owns it.

Purpose: find any booking fast, and answer "why is this one stuck?" without leaving the screen.

## Contents

| File                                          | Responsibility                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `bookings.constants.ts`                       | `BOOKING_STATES`, segments, the §4.3 state→pill mapping, query keys, page size        |
| `bookings.types.ts`                           | List/detail shapes for `GET /ops/bookings` and `/ops/bookings/{id}`                   |
| `bookings.api.ts`                             | **The only data boundary.** Wraps the mock today, the generated client tomorrow       |
| `bookings.mock.ts` · `.seed.ts` · `.fixtures.ts` · `booking-detail.fixtures.ts` | Filtering/searching/paging + the artifact-accurate records |
| `useBookingsList.ts`                          | Segment, search, filters, paging — shared by both list shells                         |
| `useBookingDetail.ts`                         | One record, plus the optimistic-concurrency and deep-link-intent rules                |
| `useBookingActions.ts`                        | State legality (§4.3, as amended) × `useCan` → the routes this record permits          |
| `useBookingCopy.ts`                           | Structured fragments → sentences, all inside `t()`                                    |
| `useBookingPreview.ts` · `useIsOffline.ts`    | Desktop preview record; connectivity for the offline states                           |
| `BookingsList.desktop.tsx` / `.mobile.tsx`    | Table + preview panel · stacked cards                                                 |
| `BookingDetailScreen.tsx` → `.desktop/.mobile`| Not-found / error / loading switch, then the three-column or stacked record           |
| `RecordText.tsx`                              | `MonoText`, `RecordSection`, `MatchHighlight` — feature-local text treatments         |

## Business logic

- **Three segments, never four.** "Scheduled" is removed: nothing is future-dated
  (`docs/Booking-Workflow-Decisions.md` D1). Admin still sees Cancelled, which also holds `FAILED`.
- **Assign only from `ESCALATED` or `FAILED`.** Dispatch is automated; admin assign is a rescue
  tool, not routine. The artifacts' "Reassign" button on a healthy booking is deliberately not
  reproduced.
- **No reschedule anywhere.** There is no route and no action.
- **The timeline is the point.** Each auto-dispatch round is an entry, carrying round number,
  radius and decline count. That is the "why did this fail" diagnostic.
- **Optimistic concurrency.** A record carries `version`; a stale one returns 409. When the record
  reports a concurrent change, every write path on the screen goes inert *together* and the banner
  offers Reload. The screen never swaps itself to the new data under the operator's thumb.
- **Deep-link rule (spec §3.4 rule 4).** An action route that finds its booking already resolved
  should send the operator to `ROUTES.bookingDetail(id)` with `?intent=<actionId>`; the detail then
  opens with the informational banner instead of the action sheet.
- **Search** is debounced 300 ms and fires from three characters, spans every segment, and matches
  the id with or without `#B-` and the phone with or without `+91`.

## Dependencies

`components/ui/*`, `components/states/QueryBoundary`, `layouts/{Topbar,MobileAppBar}`,
`lib/{format,http,permissions}`, `hooks/useDebouncedValue`, `routes/routes.constants`,
`mocks/mockTransport`, `@sethu/i18n` (namespace `adminBookings`).

## Boundaries

- No sibling-feature imports. Booking mutations are navigated to, never performed here.
- No BEM class from `styles/components.css`; only token-backed Tailwind utilities and primitives.
- `BOOKING_STATES` mirrors `backend/internal/booking/state.go` verbatim. Delete it and re-export the
  generated vocabulary the moment `@sethu/api-client` types `state` as an enum.
- Mobile is never the desktop table squeezed: two components over one `useBookingsList()` hook.

## Impacted modules

`pages/BookingsListPage.tsx`, `pages/BookingDetailPage.tsx`, and every screen that deep-links into a
booking (alerts, needs-attention, live dashboard, customer profile).
