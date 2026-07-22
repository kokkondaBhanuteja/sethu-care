// Shapes for the Live Operations Map (Admin spec §6.7).
//
// Positions are percentages of the map's coordinate space, not lat/lng. The rendered surface is an
// abstract SVG street grid (see MapSurface.tsx), and a percentage is what both that grid and a
// future tile layer can be handed: swapping in Leaflet/MapLibre means projecting lat/lng into the
// same 0-100 space inside MapSurface, and nothing above this file changes.

/** Where a marker sits, as a percentage of the map's width and height. */
export interface MapPoint {
  readonly xPercent: number;
  readonly yPercent: number;
}

/**
 * What the surface is currently showing. Handed to MapSurface as a prop so the projection lives in
 * one place; a tile layer would read the same object as centre + zoom level.
 */
export interface MapViewport {
  readonly centre: MapPoint;
  /** 1 = the whole service city. Larger values magnify around `centre`. */
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
  readonly position: MapPoint;
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
  readonly position: MapPoint;
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
