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
  /** Rendered lighter — administrative surfaces outside the exception-handling loop. */
  readonly muted?: boolean;
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
  {
    // Muted on purpose: an ops manager working an escalation should not have their eye pulled into
    // pricing or reports.
    titleKey: "nav.groupDesktopOnly",
    items: [
      { to: ROUTES.services, labelKey: "nav.services", icon: Tags, muted: true },
      { to: ROUTES.payouts, labelKey: "nav.payouts", icon: Landmark, muted: true },
      { to: ROUTES.reports, labelKey: "nav.reports", icon: Download, muted: true },
      {
        to: ROUTES.platformSettings,
        labelKey: "nav.platformSettings",
        icon: Settings,
        muted: true,
      },
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
