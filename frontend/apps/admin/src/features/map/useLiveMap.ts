import { useCallback, useMemo, useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { fetchLiveMapSnapshot } from "./map.api";
import {
  MAP_DEFAULT_LAYERS,
  MAP_DEFAULT_VIEWPORT,
  MAP_FOCUS_ZOOM,
  MAP_POLL_INTERVAL_MS,
  MAP_QUERY_KEYS,
  type MapLayer,
} from "./map.constants";
import {
  EMPTY_MARKERS,
  isMapFiltered,
  selectVisibleMarkers,
  type MapLayerState,
  type VisibleMarkers,
} from "./map.selectors";
import { MAP_LOCATION_STATES, useMapLocation, type MapLocationController } from "./useMapLocation";
import { useMapStaleness, type MapFreshness } from "./useMapStaleness";
import type { LiveMapSnapshot, MapCluster, MapPoint, MapViewport } from "./map.types";

/**
 * Everything both surfaces need, so the docked desktop panel and the mobile sheet can never drift
 * apart in behaviour — only in layout (ENGINEERING-STANDARDS Part 1.2, Admin spec §2.1).
 */
export interface LiveMapController {
  readonly query: UseQueryResult<LiveMapSnapshot>;
  readonly markers: VisibleMarkers;
  readonly layers: MapLayerState;
  readonly viewport: MapViewport;
  readonly focusedZoneId: string | null;
  readonly isFiltered: boolean;
  readonly freshness: MapFreshness;
  readonly location: MapLocationController;
  toggleLayer: (layer: MapLayer, isOn: boolean) => void;
  focusZone: (zoneId: string, centre: MapPoint) => void;
  focusCluster: (cluster: MapCluster) => void;
  recentre: () => void;
  clearFilters: () => void;
}

export function useLiveMap(): LiveMapController {
  const query = useQuery({
    queryKey: MAP_QUERY_KEYS.snapshot,
    queryFn: ({ signal }) => fetchLiveMapSnapshot(signal),
    // Positions are throttled to 10s on purpose: battery and bandwidth beat pin accuracy (§6.7).
    refetchInterval: MAP_POLL_INTERVAL_MS,
  });

  const [layers, setLayers] = useState<MapLayerState>(MAP_DEFAULT_LAYERS);
  const [viewport, setViewport] = useState<MapViewport>(MAP_DEFAULT_VIEWPORT);
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);

  const location = useMapLocation();
  const freshness = useMapStaleness(query.dataUpdatedAt);

  const snapshot = query.data;
  const markers = useMemo(
    () => (snapshot ? selectVisibleMarkers(snapshot, layers, focusedZoneId) : EMPTY_MARKERS),
    [snapshot, layers, focusedZoneId],
  );

  const toggleLayer = useCallback((layer: MapLayer, isOn: boolean) => {
    setLayers((current) => ({ ...current, [layer]: isOn }));
  }, []);

  const focusZone = useCallback((zoneId: string, centre: MapPoint) => {
    setFocusedZoneId(zoneId);
    setViewport({ centre, zoom: MAP_FOCUS_ZOOM });
  }, []);

  const focusCluster = useCallback(
    (cluster: MapCluster) => {
      focusZone(cluster.zoneId, cluster.position);
    },
    [focusZone],
  );

  const { state: locationState, requestLocation } = location;
  const recentre = useCallback(() => {
    setFocusedZoneId(null);
    setViewport(MAP_DEFAULT_VIEWPORT);
    // The prompt is asked for here and nowhere else: a permission dialog on mount would block the
    // one screen an operator opens because something is already on fire (spec §6.7 edge cases).
    if (locationState === MAP_LOCATION_STATES.idle) requestLocation();
  }, [locationState, requestLocation]);

  const clearFilters = useCallback(() => {
    setLayers(MAP_DEFAULT_LAYERS);
    setFocusedZoneId(null);
    setViewport(MAP_DEFAULT_VIEWPORT);
  }, []);

  return {
    query,
    markers,
    layers,
    viewport,
    focusedZoneId,
    isFiltered: isMapFiltered(layers, focusedZoneId),
    freshness,
    location,
    toggleLayer,
    focusZone,
    focusCluster,
    recentre,
    clearFilters,
  };
}
