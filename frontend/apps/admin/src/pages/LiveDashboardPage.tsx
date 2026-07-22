import { useIsDesktop } from "../hooks/useBreakpoint";
import { LiveDashboardDesktop } from "../features/dashboard/LiveDashboard.desktop";
import { LiveDashboardMobile } from "../features/dashboard/LiveDashboard.mobile";

/**
 * `/live` — the console's default landing screen (spec §6.5).
 *
 * The two variants are separate components, not one media-query layout: desktop renders the queue
 * as a table an operator scans down a column, mobile as stacked cards. Only one is ever mounted.
 */
export default function LiveDashboardPage() {
  return useIsDesktop() ? <LiveDashboardDesktop /> : <LiveDashboardMobile />;
}
