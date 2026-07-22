import { NavLink } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { cx } from "../lib/cx";
import { Icon } from "../components/ui/Icon";
import { useShellCounters } from "../queries/useShellCounters";
import { MOBILE_TABS } from "./navigation.constants";

/** The five-tab bottom bar. Badge discipline is enforced by the counters, not by each tab. */
export function TabBar() {
  const { t } = useTranslation("adminShell");
  const counters = useShellCounters();

  return (
    <nav className="tabbar" aria-label={t("nav.primary")}>
      {MOBILE_TABS.map((tab) => {
        const count = tab.badge ? counters[tab.badge] : 0;
        const label = t(tab.labelKey);

        return (
          <NavLink
            key={tab.tab}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => cx("tabbar__tab", isActive && "is-active")}
          >
            <Icon glyph={tab.icon} size="lg" />
            <span className="tabbar__label">{label}</span>
            {/* Positioned against .tabbar__tab itself, so no wrapper may sit between them. */}
            {count > 0 ? (
              <span
                aria-hidden
                className={cx("tabbar__badge", tab.badgeTone === "brand" && "tabbar__badge--brand")}
              >
                {count > 9 ? "9+" : count}
              </span>
            ) : null}
            {count > 0 ? (
              <span className="sr-only">
                {count} {label}
              </span>
            ) : null}
          </NavLink>
        );
      })}
    </nav>
  );
}
