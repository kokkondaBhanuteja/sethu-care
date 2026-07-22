import { MAP_DEFAULT_LAYERS, type MapLayer } from "./map.constants";
import { JOB_MAP_STATES } from "./map.types";
import type {
  LiveMapSnapshot,
  MapAttentionItem,
  MapCluster,
  MapJob,
  MapProvider,
} from "./map.types";

export type MapLayerState = Readonly<Record<MapLayer, boolean>>;

/**
 * What the map and the list both draw. Deriving one set and rendering it twice is what keeps the
 * keyboard list genuinely equivalent to the markers rather than an approximation of them.
 */
export interface VisibleMarkers {
  readonly providers: readonly MapProvider[];
  readonly jobs: readonly MapJob[];
  readonly clusters: readonly MapCluster[];
  readonly attention: readonly MapAttentionItem[];
}

export const EMPTY_MARKERS: VisibleMarkers = {
  providers: [],
  jobs: [],
  clusters: [],
  attention: [],
};

export function selectVisibleMarkers(
  snapshot: LiveMapSnapshot,
  layers: MapLayerState,
  focusedZoneId: string | null,
): VisibleMarkers {
  const inZone = (zoneId: string): boolean => focusedZoneId === null || zoneId === focusedZoneId;

  // Escalations-only repaints the map down to the one thing that needs a human, so provider pins
  // go with it — a "filtered" map that still looks fully populated is the worst state here (BOX 24).
  const showProviders = layers.providersOnline && !layers.escalationsOnly;

  return {
    providers: showProviders
      ? snapshot.providers.filter((candidate) => inZone(candidate.zoneId))
      : [],
    jobs: layers.activeJobs
      ? snapshot.jobs.filter(
          (candidate) =>
            inZone(candidate.zoneId) &&
            (!layers.escalationsOnly || candidate.state === JOB_MAP_STATES.escalated),
        )
      : [],
    // A cluster is a pile that could not be separated at this zoom; once a zone is focused its
    // members belong in the list instead.
    clusters:
      focusedZoneId === null && !layers.escalationsOnly && layers.providersOnline
        ? snapshot.clusters
        : [],
    attention: snapshot.attention.filter((candidate) => inZone(candidate.zoneId)),
  };
}

export function isMarkerSetEmpty(markers: VisibleMarkers): boolean {
  return (
    markers.providers.length === 0 &&
    markers.jobs.length === 0 &&
    markers.clusters.length === 0 &&
    markers.attention.length === 0
  );
}

const MAP_LAYER_KEYS = Object.keys(MAP_DEFAULT_LAYERS) as readonly MapLayer[];

/** True when the operator has narrowed the view, so an empty result reads as filtered (spec §4.10). */
export function isMapFiltered(layers: MapLayerState, focusedZoneId: string | null): boolean {
  if (focusedZoneId !== null) return true;
  return MAP_LAYER_KEYS.some((layer) => layers[layer] !== MAP_DEFAULT_LAYERS[layer]);
}

export function zoneNameOf(snapshot: LiveMapSnapshot, zoneId: string): string {
  return snapshot.zones.find((candidate) => candidate.id === zoneId)?.name ?? zoneId;
}

export function zeroSupplyZoneNames(snapshot: LiveMapSnapshot): readonly string[] {
  return snapshot.zeroSupplyZoneIds.map((zoneId) => zoneNameOf(snapshot, zoneId));
}
