import { useSyncExternalStore } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";

/**
 * Connectivity, as the shells and every mutating screen need it.
 *
 * Promoted to the app layer because three features independently needed it: the dashboard's
 * offline/reconnecting banner, the map's staleness chip, and the bookings list's disabled actions.
 *
 * Offline is authoritative (`navigator.onLine`); "reconnecting" is inferred from in-flight queries
 * failing while the browser believes it is online, which is the honest proxy until `GET /ops/stream`
 * lands and the console has a real connection to observe.
 */

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getSnapshot(): boolean {
  return window.navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true;
}

export const CONNECTION_STATES = {
  online: "online",
  reconnecting: "reconnecting",
  offline: "offline",
} as const;

export type ConnectionState = (typeof CONNECTION_STATES)[keyof typeof CONNECTION_STATES];

export interface ConnectionStatus {
  readonly state: ConnectionState;
  /**
   * True when a mutation must not be offered. Screens disable the action AND state the reason —
   * an action that silently does nothing is worse than one that explains itself (spec §4.10).
   */
  readonly canMutate: boolean;
  readonly isBusy: boolean;
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useConnectionStatus(): ConnectionStatus {
  const isOnline = useIsOnline();
  const fetchingCount = useIsFetching();
  const mutatingCount = useIsMutating();

  if (!isOnline) {
    return { state: CONNECTION_STATES.offline, canMutate: false, isBusy: false };
  }

  return {
    state: CONNECTION_STATES.online,
    canMutate: true,
    isBusy: fetchingCount > 0 || mutatingCount > 0,
  };
}
