import { useIsDesktop } from "../hooks/useBreakpoint";
import { ManualCompletionDesktop } from "../features/booking-actions/ManualCompletion.desktop";
import { ManualCompletionMobile } from "../features/booking-actions/ManualCompletion.mobile";
import { useManualCompletion } from "../features/booking-actions/useManualCompletion";

/** Admin-verified manual completion — the effortful alternative to an OTP override (spec §1.6). */
export default function ManualCompletionPage() {
  const isDesktop = useIsDesktop();
  const state = useManualCompletion();

  return isDesktop ? (
    <ManualCompletionDesktop state={state} />
  ) : (
    <ManualCompletionMobile state={state} />
  );
}
