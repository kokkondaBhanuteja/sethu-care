import { useRef } from "react";
import { useTranslation } from "@sethu/i18n";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.maplibre.css";
import type { ReactNode } from "react";

import { MapMarkerLayer } from "./MapMarkerLayer";
import { useMapClustering } from "./useMapClustering";
import { useMapLibre } from "./useMapLibre";
import { useMapOverlays } from "./useMapOverlays";
import type { VisibleMarkers } from "./map.selectors";
import type { MapCluster, MapJob, MapProvider, MapViewport, MapZone } from "./map.types";

/**
 * THE SWAP POINT — now swapped. The ground under the markers is a real MapLibre map over
 * OpenStreetMap raster tiles, desaturated to a quiet gray (map.style.ts) so the design's original
 * rule still holds: the base recedes far enough that a 12px marker wins the eye, and no tile's own
 * reds, greens and yellows out-shout the one escalation (BOX 24/41).
 *
 * Everything above this component still only hands over `markers`, `viewport`, `zones` and the
 * selection callbacks; the GL instance, its lifecycle and its projection are all private to this
 * file and the hooks beside it.
 */

export interface MapSurfaceProps {
  /** Which chrome frame the surface sits in; also decides where the OSM attribution is anchored. */
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
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { mapInstance, visibleBounds } = useMapLibre(containerRef, surface, viewport);
  const clustering = useMapClustering(mapInstance, markers.providers, markers.jobs);
  useMapOverlays(mapInstance, zones, markers.jobs, showServiceAreas, showDemandHeatmap);

  return (
    <div
      className={surface === "desktop" ? "map-canvas" : "map"}
      role="region"
      aria-label={t("region.label")}
    >
      {/* An explicit full-size box: MapLibre measures this element when the canvas is created,
          and a flex layout inside the webview can settle after mount — useMapLibre also forces a
          `map.resize()` one frame later for exactly that case. */}
      <div ref={containerRef} className="absolute inset-0 h-full w-full min-h-0" />

      <p className="sr-only">{t("region.hint")}</p>

      {mapInstance ? (
        <MapMarkerLayer
          mapInstance={mapInstance}
          visibleBounds={visibleBounds}
          markers={markers}
          clustering={clustering}
          zones={zones}
          zoneNameOf={zoneNameOf}
          onSelectProvider={onSelectProvider}
          onSelectJob={onSelectJob}
          onSelectCluster={onSelectCluster}
        />
      ) : null}

      {children}
    </div>
  );
}
