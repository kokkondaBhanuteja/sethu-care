import { useSyncExternalStore } from "react";

import { env } from "../lib/env";

// The 768px shell split (Admin spec §2.1). A physical device width, so px is correct here.
const SHELL_BREAKPOINT_PX = 768;
const DESKTOP_QUERY = `(min-width: ${SHELL_BREAKPOINT_PX}px)`;

/**
 * Dev-only shell override: `?shell=mobile` or `?shell=desktop`.
 *
 * MobileShell and DesktopShell are separate components, so the only way to see one is to be at its
 * width — and a desktop browser window cannot always be made narrow enough (Windows enforces a
 * minimum). Without this, mobile screens would only ever be reviewed on a device, which is how the
 * "shared codebases drift toward the dominant surface" risk in §2.1 actually materialises.
 */
function devOverride(): boolean | null {
  if (!env.isDev) return null;
  const shell = new URLSearchParams(window.location.search).get("shell");
  if (shell === "mobile") return false;
  if (shell === "desktop") return true;
  return null;
}

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return devOverride() ?? window.matchMedia(DESKTOP_QUERY).matches;
}

// Capacitor always mounts in a WebView, so there is no SSR pass; desktop is the safe server value
// for the one render Vite's preview could produce.
function getServerSnapshot(): boolean {
  return true;
}

/**
 * True at >=768px, where DesktopShell renders. MobileShell and DesktopShell stay separate
 * components on purpose: mobile layout is never media-query-squeezed desktop (spec §2.1).
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
