import { useIsDesktop } from "../hooks/useBreakpoint";
import { DesktopShell } from "./DesktopShell";
import { MobileShell } from "./MobileShell";

/**
 * Picks the shell for the current viewport. Only one is mounted at a time — rendering both and
 * hiding one with a media query would double every query, every timer and every subscription in the
 * chrome, and would let a phone quietly pay for the desktop table it never shows.
 */
export function AdminShell() {
  return useIsDesktop() ? <DesktopShell /> : <MobileShell />;
}
