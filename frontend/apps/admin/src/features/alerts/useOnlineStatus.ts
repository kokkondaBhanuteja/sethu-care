import { useSyncExternalStore } from "react";

import { env } from "../../lib/env";

/**
 * Connectivity, as the browser reports it.
 *
 * Dev-only override `?offline=1`, for the same reason useBreakpoint carries `?shell=`: the offline
 * queue state (mobile BOX 24) is otherwise only reachable by physically dropping the network, which
 * makes it the state nobody reviews.
 */
function devOverride(): boolean | null {
  if (!env.isDev) return null;
  return new URLSearchParams(window.location.search).get("offline") === "1" ? false : null;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getSnapshot(): boolean {
  return devOverride() ?? window.navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
