// Shapes for the Live Operations Map (Admin spec §6.7).
//
// Positions are real WGS84 coordinates. The rendered surface is a MapLibre map over desaturated
// OpenStreetMap raster tiles (see MapSurface.tsx and map.style.ts); everything above MapSurface
// still only hands positions around and never learns how the ground under them is drawn.

/** Where a marker sits on Earth. WGS84, the coordinate system OSM tiles are served in. */
export interface MapPoint {
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * A marker whose position could not be honestly geolocated carries null and is rendered by the
 * lists but never by the canvas (2026-07: the real /ops/live-map ships bounding-box percentages
 * without the box — see map.api.map.ts). This guard is how the GL-facing layers skip them without
 * losing the marker's own type.
 */
export function hasMapPosition<Marker extends { readonly position: MapPoint | null }>(
  marker: Marker,
): marker is Marker & { readonly position: MapPoint } {
  return marker.position !== null;
}

/**
 * Where the console has pointed the camera. Handed to MapSurface as a prop; user panning on the
 * canvas moves the camera without writing back here — this object only changes when the console
 * itself refocuses (zone focus, recentre, clear filters).
 */
export interface MapViewport {
  readonly centre: MapPoint;
  /** A web-mercator tile zoom level: ~11 shows the whole service city, ~13 a zone. */
  readonly zoom: number;
}

export const PROVIDER_MAP_STATUSES = {
  online: "online",
  busy: "busy",
  offline: "offline",
} as const;

export type ProviderMapStatus = (typeof PROVIDER_MAP_STATUSES)[keyof typeof PROVIDER_MAP_STATUSES];

/** Booking-state colours on the map: en route, on site, delayed, escalated (spec §6.7 markers). */
export const JOB_MAP_STATES = {
  enRoute: "enRoute",
  onSite: "onSite",
  delayed: "delayed",
  escalated: "escalated",
} as const;

export type JobMapState = (typeof JOB_MAP_STATES)[keyof typeof JOB_MAP_STATES];

export const ATTENTION_REASONS = {
  escalated: "escalated",
  noProvider: "noProvider",
} as const;

export type AttentionReason = (typeof ATTENTION_REASONS)[keyof typeof ATTENTION_REASONS];

export interface MapZone {
  readonly id: string;
  readonly name: string;
  readonly labelAt: MapPoint;
}

export interface MapProvider {
  readonly id: string;
  readonly name: string;
  readonly status: ProviderMapStatus;
  readonly zoneId: string;
  /** Null when the payload carried no honest coordinates (see `hasMapPosition`): list-only. */
  readonly position: MapPoint | null;
  /** Set while `status` is busy — the job this provider is currently on. */
  readonly onBookingRef?: string;
  /** An offline provider's position is its last known one, so the age has to travel with it. */
  readonly locatedAt: string;
}

export interface MapJob {
  readonly id: string;
  readonly bookingRef: string;
  readonly state: JobMapState;
  readonly zoneId: string;
  /** Null when the payload carried no honest coordinates (see `hasMapPosition`): list-only. */
  readonly position: MapPoint | null;
  readonly serviceName: string;
}

/** Overlapping markers collapse into a count rather than a pile (spec §6.7 performance rules). */
export interface MapCluster {
  readonly id: string;
  readonly zoneId: string;
  readonly position: MapPoint;
  readonly markerCount: number;
}

export interface MapAttentionItem {
  readonly id: string;
  /** What `ROUTES.bookingDetail` navigates with — the raw booking id, never the display ref. */
  readonly bookingId: string;
  /** Display-only operator reference, bare — the views add the leading "#". */
  readonly bookingRef: string;
  readonly reason: AttentionReason;
  readonly zoneId: string;
  readonly waitingSince: string;
}

export interface LiveMapSnapshot {
  /** When the server observed these positions — the input to the staleness chip. */
  readonly observedAt: string;
  /** Totals, not a marker count: the server ships the viewport's markers, never the whole city. */
  readonly activeJobCount: number;
  readonly onlineProviderCount: number;
  readonly zones: readonly MapZone[];
  readonly providers: readonly MapProvider[];
  readonly jobs: readonly MapJob[];
  readonly clusters: readonly MapCluster[];
  readonly attention: readonly MapAttentionItem[];
  /** Zones with nobody online at all — a business emergency, not a threshold (spec §6.7). */
  readonly zeroSupplyZoneIds: readonly string[];
}
