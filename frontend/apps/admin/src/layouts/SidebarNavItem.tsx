import { NavLink, useLocation } from "react-router";
import { useTranslation } from "@sethu/i18n";
import { SidebarMenuButton, SidebarMenuItem, StatusPill, useSidebar } from "@sethu/ui-web";

import { Icon } from "../components/ui/Icon";
import type { ShellCounters } from "../queries/shell.types";
import type { NavItem } from "./navigation.constants";

export interface SidebarNavItemProps {
  item: NavItem;
  counters: ShellCounters;
}

/** One rail row: NavLink + icon + label, plus either a live count badge or the v1.1 pill. */
export function SidebarNavItem({ item, counters }: SidebarNavItemProps) {
  const { t } = useTranslation("adminShell");
  const { pathname } = useLocation();
  const { open } = useSidebar();
  const count = item.badge && !item.comingSoon ? counters[item.badge] : 0;
  const label = t(item.labelKey);
  // NavLink's own matching rule, computed here because the button's `active` look needs it too.
  const isActive = item.end
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(`${item.to}/`);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        as={NavLink}
        to={item.to}
        end={item.end}
        active={isActive}
        // is-active stays as the stable structural hook (tests) beside the variant styling.
        className={isActive ? "is-active" : undefined}
        icon={<Icon glyph={item.icon} size="nav" />}
        badgeDotClassName={item.badgeTone === "brand" ? "bg-primary" : undefined}
        badge={badgeFor({ item, count, label, open, versionTag: t("nav.versionTag") })}
      >
        {label}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

interface BadgeForInput {
  item: NavItem;
  count: number;
  label: string;
  open: boolean;
  versionTag: string;
}

function badgeFor({ item, count, label, open, versionTag }: BadgeForInput) {
  if (item.comingSoon) {
    // Only while expanded: collapsed, a version note earns no attention dot (audit W2-4).
    if (!open) return undefined;
    return (
      <StatusPill tone="neutral" size="sm">
        {versionTag}
      </StatusPill>
    );
  }
  if (count <= 0) return undefined;
  return (
    <StatusPill tone={item.badgeTone === "brand" ? "brand" : "danger"} size="sm">
      <span aria-hidden>{count}</span>
      {/* The count, not just the destination: the number is the badge's only news. */}
      <span className="sr-only">
        {count} {label}
      </span>
    </StatusPill>
  );
}
