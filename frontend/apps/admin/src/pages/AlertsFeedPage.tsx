import { AlertsFeedDesktop } from "../features/alerts/AlertsFeed.desktop";
import { AlertsFeedMobile } from "../features/alerts/AlertsFeed.mobile";
import { useIsDesktop } from "../hooks/useBreakpoint";

/** `/alerts` — spec §6.20. */
export default function AlertsFeedPage() {
  return useIsDesktop() ? <AlertsFeedDesktop /> : <AlertsFeedMobile />;
}
