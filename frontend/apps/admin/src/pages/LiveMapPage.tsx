import { useIsDesktop } from "../hooks/useBreakpoint";
import { LiveMapDesktop } from "../features/map/LiveMap.desktop";
import { LiveMapMobile } from "../features/map/LiveMap.mobile";

/**
 * Route target for `/live/map` (Admin spec §6.7). Deliberately not the default view: it is the
 * heaviest screen in the console, so it is lazy-loaded by the route table and fully unmounted on
 * navigation away.
 */
export default function LiveMapPage() {
  return useIsDesktop() ? <LiveMapDesktop /> : <LiveMapMobile />;
}
