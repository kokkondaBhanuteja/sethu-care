import type { MapPoint, MapViewport } from "./map.types";

export const MAP_QUERY_KEYS = {
  snapshot: ["map", "snapshot"] as const,
} as const;

/**
 * Provider positions update via socket, throttled to 10s — battery and bandwidth matter more than
 * sub-second pin accuracy (spec §6.7). Until the stream lands the console polls at the same rate.
 */
export const MAP_POLL_INTERVAL_MS = 10_000;

/** Past three missed refreshes the pins are no longer trustworthy, so the staleness chip appears. */
export const MAP_STALE_AFTER_MS = MAP_POLL_INTERVAL_MS * 3;

/** The five layers the design ships, in the order the dock lists them. */
export const MAP_LAYERS = {
  activeJobs: "activeJobs",
  providersOnline: "providersOnline",
  escalationsOnly: "escalationsOnly",
  demandHeatmap: "demandHeatmap",
  serviceAreas: "serviceAreas",
} as const;

export type MapLayer = (typeof MAP_LAYERS)[keyof typeof MAP_LAYERS];

export const MAP_LAYER_ORDER: readonly MapLayer[] = [
  MAP_LAYERS.activeJobs,
  MAP_LAYERS.providersOnline,
  MAP_LAYERS.escalationsOnly,
  MAP_LAYERS.demandHeatmap,
  MAP_LAYERS.serviceAreas,
];

/**
 * Escalations-only and the heatmap are off by default: each hides or repaints markers, and a
 * filtered map that looks like a full one is the worst state this screen can be in (BOX 24).
 */
export const MAP_DEFAULT_LAYERS: Readonly<Record<MapLayer, boolean>> = {
  activeJobs: true,
  providersOnline: true,
  escalationsOnly: false,
  demandHeatmap: false,
  serviceAreas: false,
};

/**
 * The primary service city, centred. Location permission denied or GPS unavailable falls back to
 * exactly this rather than blocking the screen (spec §6.7 edge cases).
 */
export const PRIMARY_SERVICE_CITY_CENTRE: MapPoint = { xPercent: 50, yPercent: 50 };

export const MAP_DEFAULT_VIEWPORT: MapViewport = {
  centre: PRIMARY_SERVICE_CITY_CENTRE,
  zoom: 1,
};

/** Close enough to read a street name on a real tile layer, without losing the city's shape. */
export const MAP_FOCUS_ZOOM = 1.8;

/** Spec §6.7's hard cap. A phone dropping frames mid-escalation is worse than a missing 201st pin. */
export const MAX_DOM_MARKERS = 200;

/** Which mobile sheet is open. Only one at a time — the Sheet primitive is modal. */
export const MAP_SHEETS = {
  none: "none",
  layers: "layers",
  operations: "operations",
} as const;

export type MapSheet = (typeof MAP_SHEETS)[keyof typeof MAP_SHEETS];
