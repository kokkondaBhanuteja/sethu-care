import { useEffect, useRef, useState } from "react";
import { AttributionControl, Map as MapLibreMap } from "maplibre-gl";
import type { RefObject } from "react";

import { MAP_MIN_ZOOM } from "./map.constants";
import { toLngLat } from "./map.projection";
import { buildBaseMapStyle, OSM_TILE_MAX_ZOOM } from "./map.style";
import type { PlainBounds } from "./map.projection";
import type { MapViewport } from "./map.types";

export interface MapLibreController {
  /** Null until the GL instance exists; consumers render marker portals only once it does. */
  readonly mapInstance: MapLibreMap | null;
  /** What the camera currently frames — the input to spec §6.7's viewport-plus-buffer culling. */
  readonly visibleBounds: PlainBounds | null;
}

/**
 * Owns the GL map's whole lifecycle: created on mount, `map.remove()` in the effect cleanup so the
 * GL context never outlives the screen (spec §6.7 "unmount the GL context on blur", Part 11's
 * clean-up-everything rule). Tilt, rotation and 3D are disabled — the console reads the city
 * straight down, and a tilted map would break the marker-over-ground contract.
 */
export function useMapLibre(
  containerRef: RefObject<HTMLDivElement | null>,
  surface: "desktop" | "mobile",
  viewport: MapViewport,
): MapLibreController {
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const [visibleBounds, setVisibleBounds] = useState<PlainBounds | null>(null);

  // Only the FIRST viewport takes part in construction; later changes ease the camera instead of
  // rebuilding the map, so this ref is deliberately never updated.
  const initialViewportRef = useRef(viewport);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const createdMap = new MapLibreMap({
      container,
      style: buildBaseMapStyle(),
      center: toLngLat(initialViewportRef.current.centre),
      zoom: initialViewportRef.current.zoom,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: OSM_TILE_MAX_ZOOM,
      // The attribution control is added by hand below so each surface can place it where its
      // floating chrome leaves it visible — hiding it is not an option (OSM licensing).
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
    });
    createdMap.touchZoomRotate.disableRotation();
    createdMap.addControl(
      new AttributionControl({ compact: false }),
      // The mobile peek panel owns the bottom edge, so its credit sits below the floating header
      // (map.maplibre.css nudges it down); desktop's bottom-right corner is free.
      surface === "mobile" ? "top-right" : "bottom-right",
    );

    const updateBounds = () => {
      const bounds = createdMap.getBounds();
      setVisibleBounds({
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      });
    };
    createdMap.on("moveend", updateBounds);
    updateBounds();

    // The canvas is measured before the flex layout settles inside the shell/webview, so one
    // post-layout resize is forced; after that the observer keeps canvas and container in step.
    const settleFrame = requestAnimationFrame(() => createdMap.resize());
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => createdMap.resize());
    resizeObserver?.observe(container);

    setMapInstance(createdMap);

    return () => {
      cancelAnimationFrame(settleFrame);
      resizeObserver?.disconnect();
      createdMap.remove();
      setMapInstance(null);
      setVisibleBounds(null);
    };
  }, [containerRef, surface]);

  // Console-driven refocus (zone focus, recentre, clear filters) eases the camera; operator
  // panning never writes back into `viewport`, so the two cannot fight.
  useEffect(() => {
    if (!mapInstance) return;
    mapInstance.easeTo({ center: toLngLat(viewport.centre), zoom: viewport.zoom });
  }, [mapInstance, viewport]);

  return { mapInstance, visibleBounds };
}
