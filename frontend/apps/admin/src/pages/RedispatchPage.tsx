import { useIsDesktop } from "../hooks/useBreakpoint";
import { RedispatchDesktop } from "../features/booking-actions/Redispatch.desktop";
import { RedispatchMobile } from "../features/booking-actions/Redispatch.mobile";
import { useRedispatch } from "../features/booking-actions/useRedispatch";

/** Re-runs the automation with widened parameters — not a candidate browser. */
export default function RedispatchPage() {
  const isDesktop = useIsDesktop();
  const state = useRedispatch();

  return isDesktop ? <RedispatchDesktop state={state} /> : <RedispatchMobile state={state} />;
}
