# apps/admin/src/features/map

Scope: the Live Operations Map — `/live/map`, desktop BOX 24/25 and mobile BOX 41/42, Admin spec §6.7. Nothing else lives here; the roster, the bookings list and the alerts feed are other features and this one never imports them.

Purpose: spatial awareness. Where jobs and providers are, and where the gaps are. Deliberately not the default view: it is the heaviest screen in the console, so `routes/` lazy-loads it and it unmounts fully on navigation away.

## The map surface is a real map now — MapLibre over OpenStreetMap

`MapSurface.tsx` was the designed swap point, and the swap has happened: the ground under the markers is a **maplibre-gl** map drawing **OpenStreetMap raster tiles** (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`, maxzoom 19). Three decisions carry the old design constraint into the new surface:

1. **The quiet-gray treatment** (`map.style.ts`). The design rule that produced the old hand-drawn grid — the base map must recede far enough that a 12px marker wins the eye, and no tile's own reds, greens and yellows may out-shout the one escalation (BOX 24/41) — SURVIVES the change. The raster layer ships with `raster-saturation: -0.9`, `raster-contrast: -0.2`, `raster-opacity: 0.9`. Do not "restore the colours"; a colourful base map is a regression against the approved design.
2. **The OSM attribution is a licensing condition, not chrome.** "© OpenStreetMap contributors" (linked to openstreetmap.org/copyright) must be visible whenever the tiles are — that is the ODbL requirement for using OSM data. `useMapLibre` adds a non-compact `AttributionControl`: bottom-right on desktop, top-right on mobile (pushed below the floating header by `map.maplibre.css`, because the peek panel owns the bottom edge). Removing or hiding it is never acceptable.
3. **Positions are real WGS84 lat/lng** (`map.types.ts`). The mock fixtures keep the artifacts' percentage layout but project it onto a Hyderabad bounding box (`FIXTURE_GEO_BOUNDS` in `map.fixtures.ts`), so a running screen still resembles its design tile.

The GL lifecycle follows spec §6.7 and Part 11 exactly: the instance is created on mount, `map.remove()` runs in the effect cleanup ("unmount the GL context on blur"), the container is resize-observed with the observer disconnected on cleanup, and tilt/rotation/3D are disabled (`maxPitch: 0`, `dragRotate: false`, `pitchWithRotate: false`, `touchPitch: false`).

## Markers: HTML buttons positioned by the map

Markers are MapLibre HTML markers, not WebGL layers: `MapLibrePoint` (in `MapMarker.tsx`) mounts one `maplibregl.Marker` per pin and portals React content into it, so every marker stays a real `<button>` with an accessible name and every glyph stays an ordinary component. Placement rules (`MapMarkerLayer.tsx`):

- Only the viewport plus a 20% buffer gets DOM markers (`boundsWithBuffer`/`isWithinBounds`), and the DOM total is hard-capped at 200, jobs before providers (spec §6.7).
- **Above 50 pins MapLibre's cluster engine takes over** (`useMapClustering`): the pins go into a clustered GeoJSON source, `querySourceFeatures` reads the grouping back, and the layer renders cluster-count buttons (activate → `getClusterExpansionZoom` → ease in) plus the still-unclustered pins. Escalated jobs are **never** fed to the engine — the pulsing escalation marker must always be individually visible.
- Server-provided clusters (`MapCluster`) keep their own behaviour: selecting one focuses its zone, and the list answers "what are those 12 things".
- The demand heatmap and service-area overlays are GeoJSON fill/line layers (`useMapOverlays` + builders in `map.geojson.ts`), geographic circles that scale with zoom; their colours are design tokens resolved from the CSS custom properties at runtime, because WebGL paint cannot read `var()`.

## Contents

| File                                             | Responsibility                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `LiveMap.desktop.tsx` / `LiveMap.mobile.tsx`     | The two screens. Layout only — all behaviour is in `useLiveMap`.                           |
| `useLiveMap.ts`                                  | The shared controller: query, layers, viewport, zone focus, freshness, location.            |
| `useMapLocation.ts`                              | Geolocation permission. Never gates rendering.                                              |
| `useMapStaleness.ts`                             | `navigator.onLine` + cache age → the staleness chip.                                       |
| `MapSurface.tsx`                                 | **The swap point, swapped.** Hosts the GL container, the marker layer, the floating chrome. |
| `useMapLibre.ts`                                 | GL lifecycle: create → attribution → resize-observe → `map.remove()`; viewport → camera.    |
| `useMapClustering.ts` / `useMapOverlays.ts`      | The cluster engine wiring and the two off-by-default overlay layers.                        |
| `map.style.ts`                                   | The in-code OSM raster style: tile URL, attribution, the desaturation treatment.            |
| `map.projection.ts`                              | Pure geo arithmetic: lng/lat tuples, culling bounds, overlay circle rings.                  |
| `map.geojson.ts`                                 | Pure GeoJSON builders + the cluster-feature reader (the testable side of the GL boundary).  |
| `map.maplibre.css`                               | Feature CSS for MapLibre-generated chrome (mobile attribution offset). Token values only.   |
| `MapMarkerLayer.tsx` / `MapMarker.tsx` / `MapMarkerGlyph.tsx` | Placement + cap + cluster rendering, the portal/button, the silhouettes.       |
| `MapLegend.tsx`                                  | The key. Floating on desktop, inline in the mobile layers sheet.                            |
| `MapDock.tsx`                                    | Desktop's 320px right dock.                                                                 |
| `MapMobileHeader.tsx` / `MapFabButton.tsx` / `MapPeekPanel.tsx` / `MapSheets.tsx` | Mobile's floating controls, bottom peek and two sheets.    |
| `MapSummary.tsx` / `MapAttentionList.tsx` / `MapProviderList.tsx` | The list content both surfaces share.                                      |
| `MapZeroSupplyBanner.tsx` / `MapLocationNotice.tsx` / `MapMarkersEmpty.tsx` / `MapSkeleton.tsx` | The states.                                                  |
| `map.api.ts` / `map.api.map.ts`                  | **The data boundary, flipped.** Mock branch when `env.useMocks` (unchanged); otherwise the REAL `GET /ops/live-map` through the generated client, mapped by the pure functions in `map.api.map.ts`. |
| `map.mock.ts` / `map.fixtures.ts`                | The mock transport and the artifacts' marker positions (projected to Hyderabad).            |
| `map.types.ts` / `map.constants.ts` / `map.labels.ts` / `map.selectors.ts` | Shapes, camera + cap + threshold constants, key literals, derivation. |

## Business logic

- **Zero providers online is a warning `Banner`, not an empty state.** Spec §6.7 and BOX 25 are explicit: a zone that cannot take work at all is a business emergency. The banner names the consequence ("cannot be assigned"), not the metric, and the map keeps working behind it — the escalation it stranded is still on the canvas. BOX 25 also removes that zone's own provider markers and drops the online count, because a banner above a map still showing free technicians there teaches the operator to distrust both.
- **Location permission denied or GPS unavailable → the map still works**, centred on Hyderabad (`PRIMARY_SERVICE_CITY_CENTRE`, zoom 11), with a dismissible informational banner. The browser prompt is only ever raised by pressing Recentre, and only once.
- **Poor connectivity → the staleness chip.** Driven by the age of the data in the cache plus `navigator.onLine`, not by a server flag.
- **Layer defaults** match BOX 24: active jobs and providers on, escalations-only / heatmap / service areas off. A filtered map that looks like a full one is the worst state this screen can be in.
- **Counts are server totals, not marker counts** (`42 active · 18 providers online`).
- **The camera and the console do not fight.** `viewport` only changes when the console refocuses (zone focus, recentre, clear filters) and then eases the camera; operator panning never writes back into React state.

## Accessibility

A purely visual map is not usable by everyone, so the canvas is never the only route to a record:

- Every marker is a real `<button>` with an accessible name that always includes the status word. Colour is never the only signal — true even in clustered mode, where the count buttons say what zooming will do.
- The desktop dock and the mobile operations sheet render **the same derived marker set** (`selectVisibleMarkers`) as keyboard-reachable links. One selector, two renderings — they cannot drift.
- Offline providers get the roster's hollow grey ring rather than a filled pin, and their accessible name carries "last seen".
- The map region carries an `sr-only` hint pointing at the list.

## Testing the GL boundary

jsdom has no WebGL, so the real maplibre-gl never runs in unit tests. The split:

- Everything data-shaped is pure and tested directly: `map.style.test.ts` (tile URL, maxzoom, attribution string, the treatment values), `map.projection.test.ts` (tuple order, buffer culling, circle rings, fixtures inside the Hyderabad box), `map.geojson.test.ts` (cluster threshold, escalation exclusion, rendered-feature dedupe, heat bloom), `map.selectors.test.ts` (layer/zone derivation).
- The wiring is tested against a module-level MapLibre double: `MapSurface.test.tsx` (constructor options, attribution control placement, `map.remove()` on unmount, marker buttons + callbacks, the escalation pulse) and `MapMarkerLayer.test.tsx` (the 200 cap, clustered-mode rendering). The double's `Marker.addTo` appends the portal host into the container so Testing Library sees real buttons.
- Behaviour that genuinely needs a GPU (tile rendering, cluster regrouping) belongs to the Playwright suite, not to jsdom.

## Real mode and THE COORDINATE GAP (2026-07-23)

With `env.useMocks` false the snapshot comes from the REAL `GET /ops/live-map`: technician
positions from device pings inside the server's 15-minute freshness window (older pins are dropped
server-side, never shown stale), job pins on active bookings, the SEARCHING/ESCALATED attention
rail and CITY totals. But the payload's `MapPoint` is `{ xPercent, yPercent }` — percentages of a
bounding box the server computes over the snapshot's own markers (10%-padded,
`backend/internal/ops/livemap.go`) and does NOT include in the payload — so the projection cannot
be inverted into the WGS84 lat/lng this surface renders. The reconciliation, in `map.api.map.ts`:

- **Faithful and rendered:** the counts line, the staleness input (`observedAt`), the attention
  rail (navigating by the raw booking id), and every provider/job with its name, status
  (online/busy + `onBookingRef`/offline) and state in the dock/sheet lists.
- **Not faked:** every real marker maps with `position: null` and `hasMapPosition`
  (`map.types.ts`) keeps it out of `MapMarkerLayer`, the cluster engine and its threshold — a pin
  at a made-up place is worse than no pin. Positions remain a mock-branch capability until the
  backend ships lat/lng or declares the box.
- Zones, clusters and `zeroSupplyZoneIds` are honestly empty on the server (no zones table;
  `zoneId` is always `""` — the list rows drop the zone segment instead of printing a dangling
  separator), and the `delayed` job state never occurs. The mapper drops any future zone/cluster
  entries rather than projecting their percentages dishonestly.
- The server's `#B-XXXXXXXX` operator refs are mapped bare because the views add the `#`.

## Mock behaviour

`VITE_MOCK_MODE` drives every state without a backend (mocks are the default):

| Mode      | What you get                                                                                  |
| --------- | --------------------------------------------------------------------------------------------- |
| unset     | BOX 24 / BOX 41 — 18 online, 42 active, one escalation, one cluster of 12.                     |
| `empty`   | **BOX 25 / BOX 42 — zero providers online in Kompally.** The danger banner, Kompally's three provider markers removed, count 18 → 15. |
| `error`   | `ErrorState` + Retry, via `QueryBoundary`.                                                     |
| `slow`    | `MapSkeleton` for 3s — the layout of the screen that is arriving, never a spinner.             |

Filtered-empty is reached by turning every layer off, or by focusing a zone that the layers have emptied. Stale is reached by going offline in devtools (or waiting 30s with the network blocked).

## Dependencies

`maplibre-gl` (+ its stylesheet), `components/ui/*` (Banner, Button, Card, Sheet, Switch, StatusDot, Pill, Skeleton, EmptyState, Icon), `components/states/QueryBoundary`, `layouts/Topbar`, `lib/format`, `lib/http/apiError`, `lib/cx`, `mocks/mockTransport`, `routes/routes.constants`, `hooks/useBreakpoint` (via the page), `@sethu/i18n` namespace `adminMap`, `lucide-react`.

## Boundaries

- **The only network the base map touches is the OSM tile endpoint**, declared once in `map.style.ts`. No API keys, no vector styles, no glyph/sprite servers — the style is self-contained so the map cannot gain a second external dependency by accident.
- The GL instance never leaks out of this folder: `useMapLibre` creates it, `MapSurface` consumes it, nothing above the surface sees maplibre types.
- No sibling-feature imports. Navigation to a booking or a provider goes through `ROUTES`.
- The `.map-*` BEM classes in `styles/components.css` are the artifacts' marker and dock geometry, ported verbatim, and there is no primitive that offers them. This feature is the recorded exception that consumes them directly (`MapMarker`, `MapMarkerGlyph`, `MapLegend`, `MapSurface`, `MapDock`, `MapFabButton`, `MapMobileHeader`, `MapSkeleton`). `map.maplibre.css` is the one feature CSS file — it styles MapLibre-generated control containers no utility can reach, with token values only. Everything else is a primitive plus token-backed Tailwind utilities — no raw colour, no arbitrary px.
- Components never import `map.mock.ts`; they go through `useLiveMap` → `map.api.ts`.

## Known gaps

- **The coordinate gap** (see the real-mode section): the real endpoint's positions are
  bounding-box percentages without the box, so real markers are list-only — the canvas draws no
  pins in real mode until the backend ships invertible coordinates. Flagged to the backend; when
  it lands, `map.api.map.ts` is the one place positions come back.
- Spec §6.7's analytics events (`map_viewed`, `map_layer_toggled`, `map_marker_tapped`, `map_performance`) are not emitted — the console has no analytics client yet.
- The demand heatmap is derived from the visible job count per zone rather than from real demand; the backend owes a density field.
- The OSM public tile server's usage policy is fine for development and this console's traffic, but production at scale should move `OSM_RASTER_TILE_URL` to a commercial/ self-hosted tile provider — a one-constant change.
- Offline tile caching ("tiles degrade to cached") is whatever the browser HTTP cache holds; no service-worker tile cache yet.

## Impacted modules

`pages/LiveMapPage.tsx` and the `/live/map` route only.
