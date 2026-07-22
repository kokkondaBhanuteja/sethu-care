import type { ReactNode } from "react";
import { useTranslation } from "@sethu/i18n";

import { viewportTransform } from "./map.projection";
import { MapGridDesktop } from "./MapGridDesktop";
import { MapGridMobile } from "./MapGridMobile";
import { MapMarkerLayer } from "./MapMarkerLayer";
import { MapOverlays } from "./MapOverlays";
import type { VisibleMarkers } from "./map.selectors";
import type { MapCluster, MapJob, MapProvider, MapViewport, MapZone } from "./map.types";

/**
 * THE SWAP POINT.
 *
 * Everything above this component works in percentage coordinates and knows nothing about how the
 * ground under the markers is drawn. Today that ground is an abstract, desaturated SVG street grid,
 * because the design requires the base map to recede far enough that a 12px marker wins the eye —
 * a real tile layer's own reds, greens and yellows would make the one escalation impossible to find
 * (BOX 24/41).
 *
 * Introducing Leaflet or MapLibre (branch `feat/maps-osm`) replaces THIS FILE ONLY: mount the map
 * instance here, translate `viewport` into centre + zoom, and project each marker's lat/lng instead
 * of calling `projectPoint`. `markers`, `viewport` and the selection callbacks are the whole
 * contract. No mapping dependency and no tile URL exists anywhere in this feature today.
 */

export interface MapSurfaceProps {
  /** Which street grid to draw. The two artboards trace different cities' worth of detail. */
  surface: "desktop" | "mobile";
  viewport: MapViewport;
  markers: VisibleMarkers;
  zones: readonly MapZone[];
  zoneNameOf: (zoneId: string) => string;
  showServiceAreas: boolean;
  showDemandHeatmap: boolean;
  onSelectProvider: (provider: MapProvider) => void;
  onSelectJob: (job: MapJob) => void;
  onSelectCluster: (cluster: MapCluster) => void;
  /** Floating chrome that must sit above the markers: the legend, the header controls. */
  children?: ReactNode;
}

export function MapSurface({
  surface,
  viewport,
  markers,
  zones,
  zoneNameOf,
  showServiceAreas,
  showDemandHeatmap,
  onSelectProvider,
  onSelectJob,
  onSelectCluster,
  children,
}: MapSurfaceProps) {
  const { t } = useTranslation("adminMap");

  return (
    <div
      className={surface === "desktop" ? "map-canvas" : "map"}
      role="region"
      aria-label={t("region.label")}
    >
      {/* The base map pans and zooms as one layer; markers are projected instead of scaled, so a
          pin stays 12px whatever the zoom. */}
      <div className="absolute inset-0" style={{ transform: viewportTransform(viewport) }}>
        {surface === "desktop" ? <MapGridDesktop /> : <MapGridMobile />}
        <MapOverlays
          zones={zones}
          jobs={markers.jobs}
          showServiceAreas={showServiceAreas}
          showDemandHeatmap={showDemandHeatmap}
        />
      </div>

      <p className="sr-only">{t("region.hint")}</p>

      <MapMarkerLayer
        viewport={viewport}
        markers={markers}
        zones={zones}
        zoneNameOf={zoneNameOf}
        onSelectProvider={onSelectProvider}
        onSelectJob={onSelectJob}
        onSelectCluster={onSelectCluster}
      />

      {children}
    </div>
  );
}
