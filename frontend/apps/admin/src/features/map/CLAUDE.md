# apps/admin/src/features/map

Scope: the Live Operations Map — `/live/map`, desktop BOX 24/25 and mobile BOX 41/42, Admin spec §6.7. Nothing else lives here; the roster, the bookings list and the alerts feed are other features and this one never imports them.

Purpose: spatial awareness. Where jobs and providers are, and where the gaps are. Deliberately not the default view: it is the heaviest screen in the console, so `routes/` lazy-loads it and it unmounts fully on navigation away.

## The map surface is drawn, not fetched — and it is swappable

`MapSurface.tsx` is **the swap point**. Everything above it works in percentage coordinates and knows nothing about how the ground under the markers is drawn.

Today that ground is an abstract, desaturated SVG street grid (`MapGridDesktop.tsx`, `MapGridMobile.tsx`), traced from the artifacts. The design is explicit about why: the base map has to recede far enough that a 12px marker wins the eye, and a real tile layer's own reds, greens and yellows would make the one escalation impossible to find. Shape carries meaning before colour does — providers are circles, jobs are triangles, and the escalation is the only marker with a pulse ring.

**There is no mapping dependency and no tile URL anywhere in this feature.** Introducing Leaflet or MapLibre (branch `feat/maps-osm`) replaces `MapSurface.tsx` only: mount the map instance there, translate `viewport` into centre + zoom, project each marker's lat/lng instead of calling `projectPoint`. `markers`, `viewport`, `zones` and the three `onSelect*` callbacks are the whole contract.

`map.projection.ts` is the only place map coordinates become screen coordinates. The base grid pans and zooms as one CSS-transformed layer; markers are projected instead of scaled, so a pin stays 12px at any zoom.

## Contents

| File                                             | Responsibility                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `LiveMap.desktop.tsx` / `LiveMap.mobile.tsx`     | The two screens. Layout only — all behaviour is in `useLiveMap`.                          |
| `useLiveMap.ts`                                  | The shared controller: query, layers, viewport, zone focus, freshness, location.           |
| `useMapLocation.ts`                              | Geolocation permission. Never gates rendering.                                             |
| `useMapStaleness.ts`                             | `navigator.onLine` + cache age → the staleness chip.                                      |
| `MapSurface.tsx`                                 | **The swap point.** Grid + overlays + marker layer + floating chrome.                      |
| `MapGridDesktop.tsx` / `MapGridMobile.tsx`       | The two street grids, traced from BOX 24 / BOX 41.                                         |
| `MapOverlays.tsx`                                | Demand heatmap and service-area boundaries — the two layers that are off by default.       |
| `MapMarkerLayer.tsx` / `MapMarker.tsx` / `MapMarkerGlyph.tsx` | Placement, the accessible button, and the silhouettes.                        |
| `MapLegend.tsx`                                  | The key. Floating on desktop, inline in the mobile layers sheet.                           |
| `MapDock.tsx`                                    | Desktop's 320px right dock.                                                                |
| `MapMobileHeader.tsx` / `MapFabButton.tsx` / `MapPeekPanel.tsx` / `MapSheets.tsx` | Mobile's floating controls, bottom peek and two sheets.    |
| `MapSummary.tsx` / `MapAttentionList.tsx` / `MapProviderList.tsx` | The list content both surfaces share.                                      |
| `MapZeroSupplyBanner.tsx` / `MapLocationNotice.tsx` / `MapMarkersEmpty.tsx` / `MapSkeleton.tsx` | The states.                                                  |
| `map.api.ts` / `map.mock.ts` / `map.fixtures.ts` | The data boundary and the artifacts' marker positions.                                     |
| `map.types.ts` / `map.constants.ts` / `map.labels.ts` / `map.selectors.ts` / `map.projection.ts` | Shapes, query keys, key literals, derivation, projection.   |

## Business logic

- **Zero providers online is a warning `Banner`, not an empty state.** Spec §6.7 and BOX 25 are explicit: a zone that cannot take work at all is a business emergency. The banner names the consequence ("cannot be assigned"), not the metric, and the map keeps working behind it — the escalation it stranded is still on the canvas. BOX 25 also removes that zone's own provider markers and drops the online count, because a banner above a map still showing free technicians there teaches the operator to distrust both.
- **Location permission denied or GPS unavailable → the map still works**, centred on the primary service city, with a dismissible informational banner. The browser prompt is only ever raised by pressing Recentre, and only once: a permission dialog on mount would block the one screen an operator opens because something is already on fire.
- **Poor connectivity → the staleness chip.** Driven by the age of the data in the cache plus `navigator.onLine`, not by a server flag, because the case that matters is the one where the server cannot be reached at all.
- **Layer defaults** match BOX 24: active jobs and providers on, escalations-only / heatmap / service areas off. Each of the last three hides or repaints markers, and a filtered map that looks like a full one is the worst state this screen can be in.
- **Counts are server totals, not marker counts** (`42 active · 18 providers online`). Only the viewport plus a 20% buffer is rendered and the DOM marker count is hard-capped at 200 (spec §6.7 performance rules), so the two numbers legitimately differ.
- **Clusters focus a zone rather than pretending to zoom apart.** Selecting a cluster narrows the viewport and the list to that zone; the list is then the honest answer to "what are those 12 things".

## Accessibility

A purely visual map is not usable by everyone, so the canvas is never the only route to a record:

- Every marker is a real `<button>` with an accessible name that always includes the status word. Colour is never the only signal.
- The desktop dock and the mobile operations sheet render **the same derived marker set** (`selectVisibleMarkers`) as keyboard-reachable links. One selector, two renderings — they cannot drift.
- Offline providers get the roster's hollow grey ring rather than a filled pin, and their accessible name carries "last seen".
- The map region carries an `sr-only` hint pointing at the list.

## Mock behaviour

`VITE_MOCK_MODE` drives every state without a backend:

| Mode      | What you get                                                                                  |
| --------- | --------------------------------------------------------------------------------------------- |
| unset     | BOX 24 / BOX 41 — 18 online, 42 active, one escalation, one cluster of 12.                     |
| `empty`   | **BOX 25 / BOX 42 — zero providers online in Kompally.** The danger banner, Kompally's three provider markers removed, count 18 → 15. |
| `error`   | `ErrorState` + Retry, via `QueryBoundary`.                                                     |
| `slow`    | `MapSkeleton` for 3s — the layout of the screen that is arriving, never a spinner.             |

Filtered-empty is reached by turning every layer off, or by focusing a zone that the layers have emptied. Stale is reached by going offline in devtools (or waiting 30s with the network blocked).

## Dependencies

`components/ui/*` (Banner, Button, Card, Sheet, Switch, StatusDot, Pill, Skeleton, EmptyState, Icon), `components/states/QueryBoundary`, `layouts/Topbar`, `lib/format`, `lib/http/apiError`, `lib/cx`, `mocks/mockTransport`, `routes/routes.constants`, `hooks/useBreakpoint` (via the page), `@sethu/i18n` namespace `adminMap`, `lucide-react`.

## Boundaries

- **No mapping library, no tile URLs, no network for the base map.** Adding one is a change to `MapSurface.tsx` and to this file, and nothing else.
- No sibling-feature imports. Navigation to a booking or a provider goes through `ROUTES`.
- The `.map-*` BEM classes in `styles/components.css` are the artifacts' marker and dock geometry, ported verbatim, and there is no primitive that offers them. This feature is the recorded exception that consumes them directly (`MapMarker`, `MapMarkerGlyph`, `MapLegend`, `MapSurface`, `MapDock`, `MapFabButton`, `MapMobileHeader`, `MapSkeleton`). Everything else is a primitive plus token-backed Tailwind utilities — no raw colour, no arbitrary px.
- Components never import `map.mock.ts`; they go through `useLiveMap` → `map.api.ts`.

## Known gaps

- `GET /ops/live-map` does not exist (see `docs/admin-api-contract.md`). The mock is the normative shape.
- Spec §6.7's analytics events (`map_viewed`, `map_layer_toggled`, `map_marker_tapped`, `map_performance`) are not emitted — the console has no analytics client yet. The call sites are the three `onSelect*` handlers and `toggleLayer`.
- The demand heatmap is derived from the visible job count per zone rather than from real demand; the backend owes a density field.

## Impacted modules

`pages/LiveMapPage.tsx` and the `/live/map` route only.
