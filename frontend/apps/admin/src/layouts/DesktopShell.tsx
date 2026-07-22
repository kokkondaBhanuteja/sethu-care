import { Outlet } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { ToastHost } from "../components/ui/ToastHost";
import { Sidebar } from "./Sidebar";

/**
 * The >=768px frame: a persistent 240px sidebar and a scrolling main area. Deliberately NOT a
 * widened MobileShell — the wider canvas exists so queues can be tables an operator scans down a
 * column, which stacked cards make impossible (spec §2.1).
 *
 * Pages render their own Topbar, because the breadcrumb, the actions and the alert band are all
 * page-specific and hoisting them here would mean prop-drilling every one of them through the shell.
 */
export function DesktopShell() {
  const { t } = useTranslation("adminShell");

  return (
    <div className="app">
      <a className="sr-only focus:not-sr-only" href="#admin-main">
        {t("nav.skipToContent")}
      </a>
      <Sidebar />
      <div className="app__main" id="admin-main">
        <Outlet />
      </div>
      <ToastHost />
    </div>
  );
}
