import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getSnapshot(): boolean {
  return !window.navigator.onLine;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Connectivity, for the offline states in spec §4.10 / §9.2: cached rows still read, because stale
 * data beats no data for triage, but every write path goes inert with a stated reason.
 *
 * Feature-local for now. It belongs in `src/hooks` (or a connectivity store) the moment a second
 * feature needs it — ENGINEERING-STANDARDS Part 3.2's promote-on-second-consumer rule.
 */
export function useIsOffline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
