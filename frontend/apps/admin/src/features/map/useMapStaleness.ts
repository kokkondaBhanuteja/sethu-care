import { useEffect, useState, useSyncExternalStore } from "react";

import { MAP_STALE_AFTER_MS } from "./map.constants";

/**
 * Poor connectivity → tiles degrade to cached and markers show a staleness chip (spec §6.7).
 *
 * The chip is driven by the age of the data actually in the cache rather than by a flag the server
 * sends, because the case that matters is the one where the server cannot be reached at all: the
 * last successful snapshot stays on screen, and the operator has to be told the pins have stopped
 * moving. Losing the network makes it appear within one tick.
 */

const AGE_TICK_MS = 5_000;

export interface MapFreshness {
  readonly isStale: boolean;
  readonly isOffline: boolean;
  /** How old the positions are, for the chip's label. */
  readonly ageMs: number;
}

export function useMapStaleness(dataUpdatedAt: number): MapFreshness {
  const isOffline = useIsOffline();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), AGE_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const ageMs = dataUpdatedAt === 0 ? 0 : Math.max(0, now - dataUpdatedAt);

  return {
    isStale: dataUpdatedAt !== 0 && (isOffline || ageMs > MAP_STALE_AFTER_MS),
    isOffline,
    ageMs,
  };
}

function subscribeToConnectivity(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getIsOffline(): boolean {
  return navigator.onLine === false;
}

// Capacitor always mounts in a WebView, so there is no SSR pass; online is the safe server value.
function getIsOfflineOnServer(): boolean {
  return false;
}

function useIsOffline(): boolean {
  return useSyncExternalStore(subscribeToConnectivity, getIsOffline, getIsOfflineOnServer);
}
