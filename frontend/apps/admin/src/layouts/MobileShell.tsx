import { Outlet } from "react-router";

import { ToastHost } from "../components/ui/ToastHost";
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
  return (
    <div className="screen">
      <Outlet />
      <TabBar />
      <ToastHost />
    </div>
  );
}
