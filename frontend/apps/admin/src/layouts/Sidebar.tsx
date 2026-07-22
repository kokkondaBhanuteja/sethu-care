import { Fragment, useState } from "react";
import { NavLink } from "react-router";
import { ChevronDown, Zap } from "lucide-react";
import { useSession } from "@sethu/core";
import { useTranslation } from "@sethu/i18n";

import { cx } from "../lib/cx";
import { Avatar } from "../components/ui/Avatar";
import { Icon } from "../components/ui/Icon";
import { SignOutConfirm } from "../features/settings/SignOutConfirm";
import { APP_BUILD } from "../lib/env";
import { useShellCounters } from "../queries/useShellCounters";
import { SIDEBAR_GROUPS, type NavItem } from "./navigation.constants";
import type { ShellCounters } from "../queries/shell.types";

/**
 * The 240px persistent rail. Desktop has no tab bar and no More menu, so all eighteen destinations
 * live here — including the account group, which mobile hides behind its More tab.
 */
export function Sidebar() {
  const { t } = useTranslation("adminShell");
  const counters = useShellCounters();
  const user = useSession((state) => state.user);
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="brandmark">
          <Icon glyph={Zap} size="sm" />
        </span>
        <span className="sidebar__wordmark">{t("brand")}</span>
      </div>

      <nav className="sidebar__nav" aria-label={t("nav.primary")}>
        {SIDEBAR_GROUPS.map((group) => (
          <Fragment key={group.titleKey}>
            {group.dividerBefore ? <div className="sidebar__divider" /> : null}
            <div className="sidebar__group">
              <div className="sidebar__group-header">{t(group.titleKey)}</div>
              {group.items.map((item) => (
                <SidebarItem key={item.to} item={item} counters={counters} />
              ))}
            </div>
          </Fragment>
        ))}
      </nav>

      {user ? (
        <>
          {/* The design pins Sign out behind this row's overflow, because desktop has no More tab
              to hold it. */}
          <button
            type="button"
            className="sidebar__user w-full text-left"
            onClick={() => setIsSigningOut(true)}
          >
            <Avatar name={user.name} size="sm" brand />
            <span className="grow col truncate">
              <span className="t-emph c-1 truncate">{user.name}</span>
              <span className="t-caption c-3 truncate">{t("nav.roleOperations")}</span>
            </span>
            <span className="chevron flex">
              <Icon glyph={ChevronDown} size="sm" label={t("nav.openMenu")} />
            </span>
          </button>
          <SignOutConfirm isOpen={isSigningOut} onDismiss={() => setIsSigningOut(false)} />
        </>
      ) : null}

      <div className="sidebar__version">{APP_BUILD.label}</div>
    </aside>
  );
}

function SidebarItem({ item, counters }: { item: NavItem; counters: ShellCounters }) {
  const { t } = useTranslation("adminShell");
  const count = item.badge ? counters[item.badge] : 0;
  const label = t(item.labelKey);

  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cx("sidebar__item", item.muted && "sidebar__item--muted", isActive && "is-active")
      }
    >
      <Icon glyph={item.icon} size="nav" />
      <span className="sidebar__label">{label}</span>
      {count > 0 ? (
        <span
          className={cx(
            "sidebar__badge",
            item.badgeTone === "danger" && "sidebar__badge--danger",
            item.badgeTone === "brand" && "sidebar__badge--brand",
          )}
        >
          <span aria-hidden>{count}</span>
          <span className="sr-only">{label}</span>
        </span>
      ) : null}
    </NavLink>
  );
}
