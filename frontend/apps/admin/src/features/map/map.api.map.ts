// Pure mappers from the generated /ops/live-map payload (@sethu/api-client) onto this feature's
// normative shapes in map.types.ts. Every field is copied explicitly so a contract drift is a
// compile error here rather than a rendering surprise.
//
// THE COORDINATE GAP (2026-07-23). The real endpoint ships every position as `MapPoint
// { xPercent, yPercent }` — percentages of a bounding box the SERVER computes over the snapshot's
// own markers, 10%-padded (backend internal/ops/livemap.go `boundingBoxOf`) — and the box itself
// is NOT in the payload, so the projection cannot be inverted into the WGS84 lat/lng the MapLibre
// surface renders. Rather than fake coordinates, every real marker maps with `position: null`:
// it appears in the attention rail, the provider list and the counts (all faithful) and never on
// the canvas (`hasMapPosition` filters it out of the GL layers). The mock branch keeps its
// Hyderabad-projected fixture positions untouched. When the backend ships real lat/lng — or
// declares the box in the payload — this file is the one place positions come back.

import type {
  LiveMapSnapshot as ApiLiveMapSnapshot,
  MapAttentionItem as ApiMapAttentionItem,
  MapJob as ApiMapJob,
  MapProvider as ApiMapProvider,
} from "@sethu/api-client";

import type { LiveMapSnapshot, MapAttentionItem, MapJob, MapProvider } from "./map.types";

/**
 * The server's operator reference arrives as "#B-XXXXXXXX"; the feature carries it bare because
 * the views add the leading "#" themselves (the mock fixtures set the same convention).
 */
export function bareBookingRef(reference: string): string {
  return reference.startsWith("#") ? reference.slice(1) : reference;
}

export function mapMapProvider(payload: ApiMapProvider): MapProvider {
  return {
    id: payload.id,
    name: payload.name,
    status: payload.status,
    zoneId: payload.zoneId,
    position: null, // Percentages of an undeclared box — see the header note. Never projected.
    locatedAt: payload.locatedAt,
    ...(payload.onBookingRef !== undefined
      ? { onBookingRef: bareBookingRef(payload.onBookingRef) }
      : {}),
  };
}

export function mapMapJob(payload: ApiMapJob): MapJob {
  return {
    id: payload.id,
    bookingRef: bareBookingRef(payload.bookingRef),
    state: payload.state,
    zoneId: payload.zoneId,
    position: null, // Percentages of an undeclared box — see the header note. Never projected.
    serviceName: payload.serviceName,
  };
}

export function mapMapAttentionItem(payload: ApiMapAttentionItem): MapAttentionItem {
  return {
    id: payload.id,
    // The server's attention `id` IS the raw booking id (admin_map.go), which is exactly what
    // ROUTES.bookingDetail navigates with; the "#B-…" reference stays display-only.
    bookingId: payload.id,
    bookingRef: bareBookingRef(payload.bookingRef),
    reason: payload.reason,
    zoneId: payload.zoneId,
    waitingSince: payload.waitingSince,
  };
}

export function mapLiveMapSnapshot(payload: ApiLiveMapSnapshot): LiveMapSnapshot {
  return {
    observedAt: payload.observedAt,
    activeJobCount: payload.activeJobCount,
    onlineProviderCount: payload.onlineProviderCount,
    // No zones table exists yet, so the server declares zones and clusters EMPTY (zoneId is always
    // ""). Their positions share the coordinate gap, so any future entries are dropped here rather
    // than projected dishonestly — mapping them is part of closing the gap above.
    zones: [],
    clusters: [],
    providers: payload.providers.map(mapMapProvider),
    jobs: payload.jobs.map(mapMapJob),
    attention: payload.attention.map(mapMapAttentionItem),
    zeroSupplyZoneIds: [...payload.zeroSupplyZoneIds],
  };
}
