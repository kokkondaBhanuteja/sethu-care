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
  return window.navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true;
}

/**
 * Connectivity, for the one screen where offline is genuinely blocking.
 *
 * Most of this console is cached and usable offline (spec §9.2), but authentication never can be —
 * so login says so and disables the form rather than letting a submit fail into a toast
 * (design BOX 87).
 *
 * Promote to `hooks/` when a second feature needs it; today only login does.
 */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
