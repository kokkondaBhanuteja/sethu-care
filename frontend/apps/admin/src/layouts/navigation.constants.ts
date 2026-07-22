import {
  Activity,
  Bell,
  BarChart3,
  ClipboardList,
  CircleHelp,
  Download,
  FileText,
  Landmark,
  Map,
  MessageSquare,
  Menu,
  Settings,
  Shield,
  Siren,
  Tags,
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
  // Unused by the rail while Tickets is coming-soon (W2-4); the counter itself stays live.
  openTickets: "openTickets",
} as const;

export type BadgeSource = (typeof BADGE_SOURCES)[keyof typeof BADGE_SOURCES];

export interface NavItem {
  readonly to: string;
  /** i18n key under the adminShell:nav namespace. */
  readonly labelKey: string;
  readonly icon: LucideIcon;
  readonly badge?: BadgeSource;
  /**
   * Red means "a human must act"; brand is informational; the plain grey default is a workload
   * count. The design gives Needs attention the plain badge and Alerts the red one — the red is
   * reserved for the queue that means someone is currently stuck (spec §3.1).
   */
  readonly badgeTone?: "danger" | "brand";
  /**
   * A v1.1 destination that exists for deep-link and rail completeness only. It never carries a
   * live counter — a count on a coming-soon screen lures the operator into a dead end — and the
   * rail marks it with a version pill instead (audit W2-4).
   */
  readonly comingSoon?: boolean;
  /** Match only the exact path — set on section roots that are prefixes of their children. */
  readonly end?: boolean;
}

export interface NavGroup {
  readonly titleKey: string;
  readonly items: readonly NavItem[];
  /** A rule above the group — the design separates Account from everything operational. */
  readonly dividerBefore?: boolean;
}

/**
 * The desktop sidebar, from the design's navigation reference artboard (BOX 59).
 *
 * Desktop has no More menu and no tab bar, so everything mobile hides behind those two affordances
 * has to be addressable from this one always-visible 240px rail. Every other screen's sidebar is a
 * subset of this with a different item active.
 */
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
        // The siren, not the bell: the bell belongs to Account > Notifications below, and two
        // identical glyphs in one rail would destroy the scan (BOX 59's own note).
        labelKey: "nav.alerts",
        icon: Siren,
        badge: BADGE_SOURCES.criticalAlerts,
        badgeTone: "danger",
      },
      { to: ROUTES.customers, labelKey: "nav.customers", icon: User, comingSoon: true },
      // No openTickets badge while the screen is coming-soon: "Support tickets 4" on a
      // placeholder is a counter luring into a dead end (audit W2-4).
      { to: ROUTES.tickets, labelKey: "nav.tickets", icon: MessageSquare, comingSoon: true },
    ],
  },
  {
    titleKey: "nav.groupRecords",
    items: [
      { to: ROUTES.analytics, labelKey: "nav.analytics", icon: BarChart3, comingSoon: true },
      { to: ROUTES.audit, labelKey: "nav.audit", icon: FileText },
    ],
  },
  {
    // "Finance & config", not "Desktop only": on desktop — the only place this rail exists —
    // every one of these items works, and the old label read as "disabled" (audit W2-7).
    titleKey: "nav.groupFinance",
    items: [
      { to: ROUTES.services, labelKey: "nav.services", icon: Tags },
      { to: ROUTES.payouts, labelKey: "nav.payouts", icon: Landmark },
      { to: ROUTES.reports, labelKey: "nav.reports", icon: Download },
      { to: ROUTES.platformSettings, labelKey: "nav.platformSettings", icon: Settings },
    ],
  },
  {
    titleKey: "nav.groupAccount",
    dividerBefore: true,
    items: [
      { to: ROUTES.notificationSettings, labelKey: "nav.notifications", icon: Bell },
      { to: ROUTES.securitySettings, labelKey: "nav.security", icon: Shield },
      { to: ROUTES.support, labelKey: "nav.support", icon: CircleHelp },
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
    icon: Siren,
    badge: BADGE_SOURCES.criticalAlerts,
    badgeTone: "danger",
  },
  { tab: TABS.more, to: ROUTES.more, labelKey: "nav.more", icon: Menu },
];
