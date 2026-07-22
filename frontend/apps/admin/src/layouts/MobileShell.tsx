import { Outlet, useLocation } from "react-router";

import { ToastHost } from "../components/ui/ToastHost";
import { isFullScreenTask } from "../routes/routes.constants";
import { TabBar } from "./TabBar";

/**
 * The <768px frame: a stack-navigated screen over a five-tab bottom bar. A separate component from
 * DesktopShell on purpose — a shared codebase drifts toward the dominant surface, and mobile is the
 * default target in design review here, not the afterthought (spec §2.1).
 *
 * Pages own their own app bar and scroll region (`.screen__scroll`) because sticky headers, sticky
 * alert bands and sticky action bars all resolve against that element, not the viewport.
 */
export function MobileShell() {
  const { pathname } = useLocation();

  // Destructive and financial flows are full-screen modal tasks, and the design draws no tab bar on
  // them. That is a safety property, not a stylistic one: a visible tab bar mid-cancellation is a
  // one-tap exit from a half-filled irreversible form that bypasses the "Discard changes?" guard.
  const isTask = isFullScreenTask(pathname);

  return (
    <div className="screen">
      <Outlet />
      {isTask ? null : <TabBar />}
      <ToastHost aboveActionBar={isTask} />
    </div>
  );
}
