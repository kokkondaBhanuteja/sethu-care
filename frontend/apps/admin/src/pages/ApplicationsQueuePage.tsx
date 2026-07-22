import { ApplicationsQueueDesktop } from "../features/providers/ApplicationsQueue.desktop";
import { ApplicationsQueueMobile } from "../features/providers/ApplicationsQueue.mobile";
import { useIsDesktop } from "../hooks/useBreakpoint";

/** Route target for `/providers/applications`. */
export default function ApplicationsQueuePage() {
  return useIsDesktop() ? <ApplicationsQueueDesktop /> : <ApplicationsQueueMobile />;
}
