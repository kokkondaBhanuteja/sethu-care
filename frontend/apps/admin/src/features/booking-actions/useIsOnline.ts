import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Assignment is the one flow in the console that is BLOCKED rather than degraded when the
 * connection drops: a candidate list is a snapshot of who is free right now, and assigning from a
 * three-minute-old snapshot double-books a technician (spec §6.10).
 */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
