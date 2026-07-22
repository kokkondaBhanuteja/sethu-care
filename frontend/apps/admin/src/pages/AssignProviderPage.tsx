import { useIsDesktop } from "../hooks/useBreakpoint";
import { AssignProviderDesktop } from "../features/booking-actions/AssignProvider.desktop";
import { AssignProviderMobile } from "../features/booking-actions/AssignProvider.mobile";
import { useAssignProvider } from "../features/booking-actions/useAssignProvider";

/** Rescue-only assignment (Booking-Workflow-Decisions D3): reached from an escalation, never a queue. */
export default function AssignProviderPage() {
  const isDesktop = useIsDesktop();
  const state = useAssignProvider();

  return isDesktop ? (
    <AssignProviderDesktop state={state} />
  ) : (
    <AssignProviderMobile state={state} />
  );
}
