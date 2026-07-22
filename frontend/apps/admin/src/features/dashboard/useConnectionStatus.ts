import { useSyncExternalStore } from "react";
import { onlineManager } from "@tanstack/react-query";

/**
 * The three connection states the design distinguishes (mobile BOX 2 / 5 / 6).
 *
 * Offline and reconnecting are NOT the same event and must not look alike: offline disables every
 * mutating affordance because acting on a stale queue is how a job gets double-assigned, while a
 * dropped-and-retrying poll changes nothing but the pill — dimming content for a half-second
 * network hiccup punishes the operator for something she would never otherwise notice.
 */
export const CONNECTION_STATUSES = {
  live: "live",
  reconnecting: "reconnecting",
  offline: "offline",
} as const;

export type ConnectionStatus = (typeof CONNECTION_STATUSES)[keyof typeof CONNECTION_STATUSES];

function subscribe(onChange: () => void): () => void {
  return onlineManager.subscribe(onChange);
}

function getSnapshot(): boolean {
  return onlineManager.isOnline();
}

/** True while the browser reports a connection. TanStack's manager owns the event plumbing. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}

export interface ConnectionInput {
  /** Failed attempts on the screen's primary query — a retry in flight means "reconnecting". */
  readonly failureCount: number;
}

export function useConnectionStatus({ failureCount }: ConnectionInput): ConnectionStatus {
  const isOnline = useIsOnline();
  if (!isOnline) return CONNECTION_STATUSES.offline;
  return failureCount > 0 ? CONNECTION_STATUSES.reconnecting : CONNECTION_STATUSES.live;
}
