import { useCallback, useEffect, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

import {
  readRenderedClusterFeatures,
  shouldClusterMarkers,
  toClusterFeatureCollection,
} from "./map.geojson";
import { toLngLat } from "./map.projection";
import type { EngineCluster } from "./map.geojson";
import type { MapJob, MapProvider } from "./map.types";

const CLUSTER_SOURCE_ID = "map-marker-clusters";
/** Invisible; exists only because a source with no layer never loads tiles to query. */
const CLUSTER_PROBE_LAYER_ID = "map-marker-clusters-probe";
const CLUSTER_RADIUS_PX = 60;
const CLUSTER_MAX_ZOOM = 16;

export interface MapClusteringController {
  /** True above spec §6.7's 50-marker line; below it every pin is its own button. */
  readonly isClusteringActive: boolean;
  readonly engineClusters: readonly EngineCluster[];
  /** Null while clustering is off — meaning "render every marker", not "render none". */
  readonly unclusteredMarkerIds: ReadonlySet<string> | null;
  expandCluster: (cluster: EngineCluster) => void;
}

/**
 * MapLibre's cluster engine as the grouping brain, HTML markers as the face: the GeoJSON source
 * does the spatial math, `querySourceFeatures` reads the result back, and the marker layer renders
 * the same accessible buttons either way. Escalated jobs never enter the source (map.geojson.ts).
 */
export function useMapClustering(
  mapInstance: MapLibreMap | null,
  providers: readonly MapProvider[],
  jobs: readonly MapJob[],
): MapClusteringController {
  const isClusteringActive = shouldClusterMarkers(providers, jobs);

  const [engineClusters, setEngineClusters] = useState<readonly EngineCluster[]>([]);
  const [unclusteredMarkerIds, setUnclusteredMarkerIds] = useState<ReadonlySet<string> | null>(
    null,
  );

  useEffect(() => {
    if (!mapInstance) return undefined;
    if (!isClusteringActive) {
      // Removal happens here, in the effect body, never in the cleanup: on unmount the map itself
      // is being removed and touching its style again would race that teardown.
      if (mapInstance.getLayer(CLUSTER_PROBE_LAYER_ID)) {
        mapInstance.removeLayer(CLUSTER_PROBE_LAYER_ID);
      }
      if (mapInstance.getSource(CLUSTER_SOURCE_ID)) {
        mapInstance.removeSource(CLUSTER_SOURCE_ID);
      }
      setEngineClusters([]);
      setUnclusteredMarkerIds(null);
      return undefined;
    }

    const readRenderedState = () => {
      const rendered = readRenderedClusterFeatures(
        mapInstance.querySourceFeatures(CLUSTER_SOURCE_ID),
      );
      setEngineClusters(rendered.clusters);
      setUnclusteredMarkerIds(rendered.unclusteredMarkerIds);
    };

    const apply = () => {
      const data = toClusterFeatureCollection(providers, jobs);
      const existingSource = mapInstance.getSource(CLUSTER_SOURCE_ID) as GeoJSONSource | undefined;
      if (existingSource) {
        existingSource.setData(data);
      } else {
        mapInstance.addSource(CLUSTER_SOURCE_ID, {
          type: "geojson",
          data,
          cluster: true,
          clusterRadius: CLUSTER_RADIUS_PX,
          clusterMaxZoom: CLUSTER_MAX_ZOOM,
        });
        mapInstance.addLayer({
          id: CLUSTER_PROBE_LAYER_ID,
          type: "circle",
          source: CLUSTER_SOURCE_ID,
          paint: { "circle-radius": 0, "circle-opacity": 0 },
        });
      }
      readRenderedState();
    };

    const applyWhenReady = () => {
      if (mapInstance.isStyleLoaded()) apply();
      else mapInstance.on("load", apply);
    };
    applyWhenReady();

    // The engine regroups on every camera change, and `sourcedata` covers the async tile loads.
    mapInstance.on("moveend", readRenderedState);
    mapInstance.on("sourcedata", readRenderedState);

    // Only listener teardown here — see the removal note above.
    return () => {
      mapInstance.off("load", apply);
      mapInstance.off("moveend", readRenderedState);
      mapInstance.off("sourcedata", readRenderedState);
    };
  }, [mapInstance, isClusteringActive, providers, jobs]);

  const expandCluster = useCallback(
    (cluster: EngineCluster) => {
      const source = mapInstance?.getSource(CLUSTER_SOURCE_ID) as GeoJSONSource | undefined;
      if (!mapInstance || !source) return;
      void source
        .getClusterExpansionZoom(cluster.clusterId)
        .then((zoom) => mapInstance.easeTo({ center: toLngLat(cluster.position), zoom }))
        .catch(() => undefined); // A stale cluster id after regrouping is harmless — ignore.
    },
    [mapInstance],
  );

  return { isClusteringActive, engineClusters, unclusteredMarkerIds, expandCluster };
}
