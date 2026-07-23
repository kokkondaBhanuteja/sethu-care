import type { Feature, FeatureCollection, LineString, Point, Polygon } from "geojson";

import { MAP_CLUSTER_THRESHOLD } from "./map.constants";
import { circleRingAround, toLngLat } from "./map.projection";
import { JOB_MAP_STATES, hasMapPosition } from "./map.types";
import type { MapJob, MapPoint, MapProvider, MapZone } from "./map.types";

// Pure GeoJSON builders for everything the GL map is fed. Kept free of MapLibre imports so the
// data side of the surface is unit-testable in jsdom, where a WebGL context does not exist.

export const MARKER_FEATURE_KINDS = { provider: "provider", job: "job" } as const;
export type MarkerFeatureKind = (typeof MARKER_FEATURE_KINDS)[keyof typeof MARKER_FEATURE_KINDS];

export interface MarkerFeatureProperties {
  readonly markerId: string;
  readonly kind: MarkerFeatureKind;
}

/**
 * True once the PIN count crosses spec §6.7's "cluster above 50 markers". Unpositioned markers
 * (the real payload's coordinate gap — map.api.map.ts) never become pins, so they do not count.
 */
export function shouldClusterMarkers(
  providers: readonly MapProvider[],
  jobs: readonly MapJob[],
): boolean {
  return (
    providers.filter(hasMapPosition).length + jobs.filter(hasMapPosition).length >
    MAP_CLUSTER_THRESHOLD
  );
}

/**
 * The clustering source's data. Escalated jobs are deliberately left out: the one marker that must
 * always win the eye can never be allowed to disappear into a count bubble.
 */
export function toClusterFeatureCollection(
  providers: readonly MapProvider[],
  jobs: readonly MapJob[],
): FeatureCollection<Point, MarkerFeatureProperties> {
  const markerFeature = (
    markerId: string,
    kind: MarkerFeatureKind,
    position: MapPoint,
  ): Feature<Point, MarkerFeatureProperties> => ({
    type: "Feature",
    properties: { markerId, kind },
    geometry: { type: "Point", coordinates: toLngLat(position) },
  });

  return {
    type: "FeatureCollection",
    features: [
      ...providers
        .filter(hasMapPosition)
        .map((provider) =>
          markerFeature(provider.id, MARKER_FEATURE_KINDS.provider, provider.position),
        ),
      ...jobs
        .filter((job) => job.state !== JOB_MAP_STATES.escalated)
        .filter(hasMapPosition)
        .map((job) => markerFeature(job.id, MARKER_FEATURE_KINDS.job, job.position)),
    ],
  };
}

/** What MapLibre's cluster engine grouped a pile of pins into, back in feature vocabulary. */
export interface EngineCluster {
  readonly clusterId: number;
  readonly markerCount: number;
  readonly position: MapPoint;
}

export interface RenderedClusterState {
  readonly clusters: readonly EngineCluster[];
  readonly unclusteredMarkerIds: ReadonlySet<string>;
}

/** The loose shape `querySourceFeatures` hands back — typed here so the reader stays pure. */
export interface RenderedSourceFeature {
  readonly geometry: { readonly type: string; readonly coordinates?: unknown };
  readonly properties: Record<string, unknown>;
}

/**
 * Splits the engine's rendered features into clusters and free-standing pins. Tile borders make
 * `querySourceFeatures` repeat features, so both sides dedupe by their stable id.
 */
export function readRenderedClusterFeatures(
  features: readonly RenderedSourceFeature[],
): RenderedClusterState {
  const clustersById = new Map<number, EngineCluster>();
  const unclusteredMarkerIds = new Set<string>();

  for (const feature of features) {
    const { properties } = feature;
    if (properties["cluster"] === true) {
      const clusterId = Number(properties["cluster_id"]);
      const coordinates = feature.geometry.coordinates as [number, number];
      clustersById.set(clusterId, {
        clusterId,
        markerCount: Number(properties["point_count"]),
        position: { longitude: coordinates[0], latitude: coordinates[1] },
      });
    } else if (typeof properties["markerId"] === "string") {
      unclusteredMarkerIds.add(properties["markerId"]);
    }
  }

  return { clusters: [...clustersById.values()], unclusteredMarkerIds };
}

/** Geographic sizes for the two off-by-default overlays; heat blooms wider with demand. */
export const HEAT_INNER_RADIUS_KM = 0.8;
export const HEAT_OUTER_RADIUS_KM = 1.6;
export const HEAT_INNER_OPACITY = 0.22;
export const HEAT_OUTER_OPACITY = 0.12;
export const SERVICE_AREA_RADIUS_KM = 2.4;

export interface HeatFeatureProperties {
  readonly opacity: number;
}

/** Heat is demand: a zone with more running jobs blooms wider (same rule the SVG overlay had). */
export function toDemandHeatCollection(
  zones: readonly MapZone[],
  jobs: readonly MapJob[],
): FeatureCollection<Polygon, HeatFeatureProperties> {
  const bloom = (
    zone: MapZone,
    baseRadiusKm: number,
    opacity: number,
  ): Feature<Polygon, HeatFeatureProperties> => {
    const jobsHere = jobs.filter((candidate) => candidate.zoneId === zone.id).length;
    const radiusKm = baseRadiusKm * (1 + jobsHere / 4);
    return {
      type: "Feature",
      properties: { opacity },
      geometry: { type: "Polygon", coordinates: [circleRingAround(zone.labelAt, radiusKm)] },
    };
  };

  return {
    type: "FeatureCollection",
    features: zones.flatMap((zone) => [
      bloom(zone, HEAT_OUTER_RADIUS_KM, HEAT_OUTER_OPACITY),
      bloom(zone, HEAT_INNER_RADIUS_KM, HEAT_INNER_OPACITY),
    ]),
  };
}

export function toServiceAreaCollection(
  zones: readonly MapZone[],
): FeatureCollection<LineString, Record<string, never>> {
  return {
    type: "FeatureCollection",
    features: zones.map((zone) => ({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: circleRingAround(zone.labelAt, SERVICE_AREA_RADIUS_KM),
      },
    })),
  };
}
