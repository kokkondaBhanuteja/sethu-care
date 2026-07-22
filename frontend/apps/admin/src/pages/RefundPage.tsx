import { useIsDesktop } from "../hooks/useBreakpoint";
import { RefundDesktop } from "../features/booking-actions/Refund.desktop";
import { RefundMobile } from "../features/booking-actions/Refund.mobile";
import { useRefund } from "../features/booking-actions/useRefund";

/** The one finance action permitted on mobile (spec §1.5's money boundary). */
export default function RefundPage() {
  const isDesktop = useIsDesktop();
  const state = useRefund();

  return isDesktop ? <RefundDesktop state={state} /> : <RefundMobile state={state} />;
}
