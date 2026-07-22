import type { ReactNode } from "react";

import type { ScreenOffset } from "./map.projection";

export interface MapMarkerProps {
  offset: ScreenOffset;
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
 * sheet list the same set (spec §6.7).
 */
export function MapMarker({ offset, label, onSelect, children }: MapMarkerProps) {
  return (
    <button
      type="button"
      className="map-marker"
      // Data-driven placement: a marker's position is not a design value, it is the payload.
      style={{ left: `${offset.leftPercent}%`, top: `${offset.topPercent}%` }}
      aria-label={label}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

export interface MapZoneLabelProps {
  offset: ScreenOffset;
  name: string;
}

/** The only text drawn on the map itself. Decorative — zone names are in the list too. */
export function MapZoneLabel({ offset, name }: MapZoneLabelProps) {
  return (
    <span
      className="map__label"
      style={{ left: `${offset.leftPercent}%`, top: `${offset.topPercent}%` }}
      aria-hidden
    >
      {name}
    </span>
  );
}
