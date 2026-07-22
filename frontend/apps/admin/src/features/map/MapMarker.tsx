import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Marker } from "maplibre-gl";
import type { ReactNode } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

import { toLngLat } from "./map.projection";
import type { MapPoint } from "./map.types";

export interface MapLibrePointProps {
  mapInstance: MapLibreMap;
  position: MapPoint;
  children: ReactNode;
}

/**
 * One MapLibre marker as a React portal: the GL map owns the element's screen position, React owns
 * what is inside it. This is how every glyph keeps being a normal component — and every marker a
 * real button — on top of a WebGL canvas.
 */
export function MapLibrePoint({ mapInstance, position, children }: MapLibrePointProps) {
  const [hostElement] = useState(() => document.createElement("div"));

  useEffect(() => {
    const marker = new Marker({ element: hostElement })
      .setLngLat(toLngLat(position))
      .addTo(mapInstance);
    return () => {
      marker.remove();
    };
    // Position updates re-run this effect; recreating the marker is cheap at this cadence (10s
    // polls) and keeps the effect's cleanup symmetrical with what it created (Part 11).
  }, [mapInstance, hostElement, position]);

  return createPortal(children, hostElement);
}

export interface MapMarkerProps {
  /**
   * The marker's accessible name. Required, and it always carries the status word: colour is never
   * the only signal, and a bare coloured dot is not a status (ENGINEERING-STANDARDS Part 11).
   */
  label: string;
  onSelect: () => void;
  children: ReactNode;
}

/**
 * One marker. A real button, so it is tab-reachable, activates with Enter and Space and takes the
 * global focus ring — but never the only route to the record it represents: the dock and the mobile
 * sheet list the same set (spec §6.7). Positioning comes from the MapLibre marker element around
 * it; `.map-marker`'s centring transform anchors the button on the point itself.
 */
export function MapMarker({ label, onSelect, children }: MapMarkerProps) {
  return (
    <button type="button" className="map-marker" aria-label={label} onClick={onSelect}>
      {children}
    </button>
  );
}

/** The only text drawn on the map itself. Decorative — zone names are in the list too. */
export function MapZoneLabel({ name }: { name: string }) {
  return (
    <span className="map__label" aria-hidden>
      {name}
    </span>
  );
}
