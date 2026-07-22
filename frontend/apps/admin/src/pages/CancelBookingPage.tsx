import { useIsDesktop } from "../hooks/useBreakpoint";
import { CancelBookingDesktop } from "../features/booking-actions/CancelBooking.desktop";
import { CancelBookingMobile } from "../features/booking-actions/CancelBooking.mobile";
import { useCancelBooking } from "../features/booking-actions/useCancelBooking";

/** Emergency-only cancellation (Booking-Workflow-Decisions §4.3). */
export default function CancelBookingPage() {
  const isDesktop = useIsDesktop();
  const state = useCancelBooking();

  return isDesktop ? <CancelBookingDesktop state={state} /> : <CancelBookingMobile state={state} />;
}
