import { SuspendProviderDesktop } from "../features/providers/SuspendProvider.desktop";
import { SuspendProviderMobile } from "../features/providers/SuspendProvider.mobile";
import { useIsDesktop } from "../hooks/useBreakpoint";

/**
 * Route target for `/providers/:providerId/suspend`. Desktop draws the flow as a modal over the
 * record; mobile takes the whole screen.
 */
export default function SuspendProviderPage() {
  return useIsDesktop() ? <SuspendProviderDesktop /> : <SuspendProviderMobile />;
}
