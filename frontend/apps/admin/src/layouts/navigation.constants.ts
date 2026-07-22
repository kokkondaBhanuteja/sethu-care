import {
  Activity,
  Bell,
  BarChart3,
  ClipboardList,
  FileText,
  Map,
  MessageSquare,
  Menu,
  TriangleAlert,
  User,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ROUTES, TABS, type Tab } from "../routes/routes.constants";

/** Which live counter, if any, drives an item's badge. */
export const BADGE_SOURCES = {
  criticalAlerts: "criticalAlerts",
  needsAttention: "needsAttention",
  pendingApplications: "pendingApplications",
  openTickets: "openTickets",
} as const;

export type BadgeSource = (typeof BADGE_SOURCES)[keyof typeof BADGE_SOURCES];

export interface NavItem {
  readonly to: string;
  /** i18n key under the adminShell:nav namespace. */
  readonly labelKey: string;
  readonly icon: LucideIcon;
  readonly badge?: BadgeSource;
  /** Red badges mean "a human must act"; brand badges are informational (spec §3.1). */
  readonly badgeTone?: "danger" | "brand";
  /** Match only the exact path — set on section roots that are prefixes of their children. */
  readonly end?: boolean;
}

export interface NavGroup {
  readonly titleKey: string;
  readonly items: readonly NavItem[];
}

/** The desktop sidebar, grouped exactly as the design specifies. */
export const SIDEBAR_GROUPS: readonly NavGroup[] = [
  {
    titleKey: "nav.groupLive",
    items: [
      { to: ROUTES.live, labelKey: "nav.live", icon: Activity, end: true },
      {
        to: ROUTES.liveAttention,
        labelKey: "nav.attention",
        icon: TriangleAlert,
        badge: BADGE_SOURCES.needsAttention,
        badgeTone: "danger",
      },
      { to: ROUTES.liveMap, labelKey: "nav.map", icon: Map },
    ],
  },
  {
    titleKey: "nav.groupOperations",
    items: [
      { to: ROUTES.bookings, labelKey: "nav.bookings", icon: ClipboardList },
      { to: ROUTES.providers, labelKey: "nav.providers", icon: Users, end: true },
      {
        to: ROUTES.alerts,
        labelKey: "nav.alerts",
        icon: Bell,
        badge: BADGE_SOURCES.criticalAlerts,
        badgeTone: "danger",
      },
      { to: ROUTES.customers, labelKey: "nav.customers", icon: User },
      {
        to: ROUTES.tickets,
        labelKey: "nav.tickets",
        icon: MessageSquare,
        badge: BADGE_SOURCES.openTickets,
        badgeTone: "brand",
      },
    ],
  },
  {
    titleKey: "nav.groupRecords",
    items: [
      { to: ROUTES.analytics, labelKey: "nav.analytics", icon: BarChart3 },
      { to: ROUTES.audit, labelKey: "nav.audit", icon: FileText },
    ],
  },
];

export interface TabItem extends NavItem {
  readonly tab: Tab;
}

/**
 * The five mobile tabs (spec §3.1). Five is the maximum before targets get too small; fewer would
 * force excessive nesting in an app whose entire value is speed.
 */
export const MOBILE_TABS: readonly TabItem[] = [
  { tab: TABS.live, to: ROUTES.live, labelKey: "nav.live", icon: Activity, end: true },
  { tab: TABS.bookings, to: ROUTES.bookings, labelKey: "nav.bookings", icon: ClipboardList },
  {
    tab: TABS.providers,
    to: ROUTES.providers,
    labelKey: "nav.providers",
    icon: Users,
    badge: BADGE_SOURCES.pendingApplications,
    badgeTone: "brand",
    end: true,
  },
  {
    tab: TABS.alerts,
    to: ROUTES.alerts,
    labelKey: "nav.alerts",
    icon: Bell,
    badge: BADGE_SOURCES.criticalAlerts,
    badgeTone: "danger",
  },
  { tab: TABS.more, to: ROUTES.more, labelKey: "nav.more", icon: Menu },
];
