import { useEffect } from "react";
import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

import { toDemandHeatCollection, toServiceAreaCollection } from "./map.geojson";
import type { MapJob, MapZone } from "./map.types";

// The two off-by-default overlays (BOX 24), now GeoJSON layers on the GL map so they pan and scale
// with the tiles. Colours are the design tokens, resolved from the CSS custom properties at
// runtime — WebGL paint cannot read `var()`, and a raw hex here would smuggle a colour past the
// token system.

const HEAT_SOURCE_ID = "map-demand-heat";
const HEAT_LAYER_ID = "map-demand-heat-layer";
const SERVICE_AREA_SOURCE_ID = "map-service-areas";
const SERVICE_AREA_LAYER_ID = "map-service-areas-layer";

const HEAT_COLOR_TOKEN = "--warning";
const SERVICE_AREA_COLOR_TOKEN = "--border-strong";
const SERVICE_AREA_DASH = [3, 2];
const SERVICE_AREA_LINE_WIDTH = 1.5;

function resolveTokenColor(variableName: string): string {
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  // Outside a themed document (tests) the token does not resolve; transparent keeps the style
  // valid without inventing a colour.
  return resolved === "" ? "transparent" : resolved;
}

export function useMapOverlays(
  mapInstance: MapLibreMap | null,
  zones: readonly MapZone[],
  jobs: readonly MapJob[],
  showServiceAreas: boolean,
  showDemandHeatmap: boolean,
): void {
  useEffect(() => {
    if (!mapInstance) return undefined;

    const apply = () => {
      syncGeoJsonLayer(mapInstance, {
        sourceId: HEAT_SOURCE_ID,
        isOn: showDemandHeatmap,
        data: toDemandHeatCollection(zones, jobs),
        addLayer: () =>
          mapInstance.addLayer({
            id: HEAT_LAYER_ID,
            type: "fill",
            source: HEAT_SOURCE_ID,
            paint: {
              "fill-color": resolveTokenColor(HEAT_COLOR_TOKEN),
              "fill-opacity": ["get", "opacity"],
            },
          }),
        layerId: HEAT_LAYER_ID,
      });

      syncGeoJsonLayer(mapInstance, {
        sourceId: SERVICE_AREA_SOURCE_ID,
        isOn: showServiceAreas,
        data: toServiceAreaCollection(zones),
        addLayer: () =>
          mapInstance.addLayer({
            id: SERVICE_AREA_LAYER_ID,
            type: "line",
            source: SERVICE_AREA_SOURCE_ID,
            paint: {
              "line-color": resolveTokenColor(SERVICE_AREA_COLOR_TOKEN),
              "line-width": SERVICE_AREA_LINE_WIDTH,
              "line-dasharray": SERVICE_AREA_DASH,
            },
          }),
        layerId: SERVICE_AREA_LAYER_ID,
      });
    };

    if (mapInstance.isStyleLoaded()) {
      apply();
      return undefined;
    }
    mapInstance.on("load", apply);
    return () => {
      mapInstance.off("load", apply);
    };
  }, [mapInstance, zones, jobs, showServiceAreas, showDemandHeatmap]);
}

interface GeoJsonLayerSync {
  readonly sourceId: string;
  readonly layerId: string;
  readonly isOn: boolean;
  readonly data: FeatureCollection;
  readonly addLayer: () => unknown;
}

/** Adds, updates or removes one source + layer pair to match its toggle. */
function syncGeoJsonLayer(mapInstance: MapLibreMap, sync: GeoJsonLayerSync): void {
  const existingSource = mapInstance.getSource(sync.sourceId) as GeoJSONSource | undefined;

  if (!sync.isOn) {
    if (mapInstance.getLayer(sync.layerId)) mapInstance.removeLayer(sync.layerId);
    if (existingSource) mapInstance.removeSource(sync.sourceId);
    return;
  }

  if (existingSource) {
    existingSource.setData(sync.data);
    return;
  }
  mapInstance.addSource(sync.sourceId, { type: "geojson", data: sync.data });
  sync.addLayer();
}
