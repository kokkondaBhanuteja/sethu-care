import { useCallback, useState } from "react";

/**
 * The operator's own position, used only to recentre. Spec §6.7: location permission denied or GPS
 * unavailable means the map still works, centred on the primary service city, with a non-blocking
 * prompt — so nothing here ever gates rendering, and every failure resolves to a state the screen
 * can simply mention.
 */

export const MAP_LOCATION_STATES = {
  /** Never asked. The browser prompt only appears when the operator presses Recentre. */
  idle: "idle",
  requesting: "requesting",
  granted: "granted",
  denied: "denied",
  /** GPS is off, the fix timed out, or the browser has no geolocation at all. */
  unavailable: "unavailable",
} as const;

export type MapLocationState = (typeof MAP_LOCATION_STATES)[keyof typeof MAP_LOCATION_STATES];

const FIX_TIMEOUT_MS = 8_000;

export interface MapLocationController {
  readonly state: MapLocationState;
  /** True once the operator has been told the map is on the city fallback; keeps the prompt quiet. */
  readonly isNoticeDismissed: boolean;
  requestLocation: () => void;
  dismissNotice: () => void;
}

export function useMapLocation(): MapLocationController {
  const [state, setState] = useState<MapLocationState>(MAP_LOCATION_STATES.idle);
  const [isNoticeDismissed, setIsNoticeDismissed] = useState(false);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState(MAP_LOCATION_STATES.unavailable);
      setIsNoticeDismissed(false);
      return;
    }

    setState(MAP_LOCATION_STATES.requesting);
    navigator.geolocation.getCurrentPosition(
      () => setState(MAP_LOCATION_STATES.granted),
      (error) => {
        setState(
          error.code === error.PERMISSION_DENIED
            ? MAP_LOCATION_STATES.denied
            : MAP_LOCATION_STATES.unavailable,
        );
        setIsNoticeDismissed(false);
      },
      { timeout: FIX_TIMEOUT_MS, maximumAge: FIX_TIMEOUT_MS },
    );
  }, []);

  const dismissNotice = useCallback(() => setIsNoticeDismissed(true), []);

  return { state, isNoticeDismissed, requestLocation, dismissNotice };
}

/** Denied and unavailable are the same outcome for the operator: the city-centred fallback. */
export function isLocationFallback(state: MapLocationState): boolean {
  return state === MAP_LOCATION_STATES.denied || state === MAP_LOCATION_STATES.unavailable;
}
