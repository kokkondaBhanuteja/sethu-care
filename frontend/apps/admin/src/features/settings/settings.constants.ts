// Query keys, channel vocabularies and the More-menu item table. Nothing here is a URL — routes come
// from routes.constants.ts — and nothing here is user-facing text: every label is an i18n key.

import {
  BarChart3,
  Bell,
  CircleHelp,
  FileText,
  MessageSquare,
  Shield,
  SunMedium,
  User,
  type LucideIcon,
} from "lucide-react";

import { ROUTES } from "../../routes/routes.constants";

export const SETTINGS_QUERY_KEYS = {
  notifications: ["settings", "notifications"] as const,
  security: ["settings", "security"] as const,
  profile: ["settings", "profile"] as const,
  version: ["settings", "version"] as const,
  payouts: ["settings", "payouts"] as const,
  queuedActions: ["settings", "queued-actions"] as const,
};

/**
 * The four alert types that cannot be silenced (spec §6.30). They are not preferences, so they carry
 * no stored value — the screen shows a lock where every other row shows a switch.
 */
export const CRITICAL_CHANNELS = [
  "bookingEscalated",
  "assignmentFailed",
  "slaBreached",
  "bookingDisputed",
] as const;

export const CONFIGURABLE_CHANNELS = [
  "slaAtRisk",
  "providerNoShow",
  "zoneSupplyCritical",
  "paymentFailure",
  "newApplications",
  "autoSuspensions",
  "documentExpiring",
  "dailySummary",
] as const;

/** Group → the channels it lists, in the order the design draws them. */
export const OPERATIONAL_CHANNELS = [
  "slaAtRisk",
  "providerNoShow",
  "zoneSupplyCritical",
  "paymentFailure",
] as const;

export const PROVIDER_CHANNELS = ["newApplications", "autoSuspensions", "documentExpiring"] as const;

/**
 * The channels whose name does not explain itself. Desktop has the width to print the explanation
 * under the label; the phone does not, and the design leaves it off there.
 */
export const CHANNELS_WITH_DETAIL: readonly string[] = [
  "slaAtRisk",
  "zoneSupplyCritical",
  "dailySummary",
];

export const APPEARANCE_MODES = ["light", "dark", "system"] as const;

export const DEVICE_KINDS = { phone: "phone", tablet: "tablet" } as const;

export const SECURITY_EVENT_KINDS = {
  signedIn: "signedIn",
  failedSignIn: "failedSignIn",
  deviceTrusted: "deviceTrusted",
  passwordChanged: "passwordChanged",
} as const;

export const PAYOUT_STATUSES = { ready: "ready", onHold: "onHold", blocked: "blocked" } as const;

export const DESKTOP_SURFACES = {
  payouts: "payouts",
  services: "services",
  reports: "reports",
  platform: "platform",
  pricing: "pricing",
} as const;

export interface MoreMenuItem {
  readonly to: string;
  /** Key in this feature's namespace, so the More menu owns its own wording. */
  readonly labelKey: string;
  readonly icon?: LucideIcon;
  /** Rows whose count comes from the shell counters (spec §3.1 badge discipline). */
  readonly badge?: "openTickets";
  /** Rows that display a live preference value rather than only a chevron. */
  readonly valueFrom?: "appearance";
}

export const MORE_OPERATIONS_ITEMS: readonly MoreMenuItem[] = [
  { to: ROUTES.customers, labelKey: "more.itemCustomers", icon: User },
  { to: ROUTES.tickets, labelKey: "more.itemTickets", icon: MessageSquare, badge: "openTickets" },
  { to: ROUTES.analytics, labelKey: "more.itemAnalytics", icon: BarChart3 },
  { to: ROUTES.audit, labelKey: "more.itemAudit", icon: FileText },
];

/**
 * Listed rather than hidden, with an external-link arrow rather than a chevron: a chevron promises
 * "deeper in this app" and these rows do not deliver that (spec §6.22).
 */
export const MORE_DESKTOP_ITEMS: readonly MoreMenuItem[] = [
  { to: ROUTES.services, labelKey: "more.itemServices" },
  { to: ROUTES.payouts, labelKey: "more.itemPayouts" },
  { to: ROUTES.reports, labelKey: "more.itemReports" },
  { to: ROUTES.platformSettings, labelKey: "more.itemPlatform" },
];

/** Appearance has no screen of its own — the row shows the current mode and opens the profile. */
export const MORE_ACCOUNT_ITEMS: readonly MoreMenuItem[] = [
  { to: ROUTES.notificationSettings, labelKey: "more.itemNotifications", icon: Bell },
  { to: ROUTES.securitySettings, labelKey: "more.itemSecurity", icon: Shield },
  { to: ROUTES.profile, labelKey: "more.appearance", icon: SunMedium, valueFrom: "appearance" },
  { to: ROUTES.support, labelKey: "more.itemSupport", icon: CircleHelp },
];

export const SUPPORT_FAQ_IDS = [
  "reassign",
  "manual",
  "escalation",
  "suspend",
  "refund",
  "lostPhone",
] as const;

export const LOST_DEVICE_STEP_KEYS = [
  "security.lostDeviceStep1",
  "security.lostDeviceStep2",
  "security.lostDeviceStep3",
  "security.lostDeviceStep4",
] as const;

/**
 * Dev-only triggers that make the two dangerous notification states reachable without a phone.
 * Documented in this folder's CLAUDE.md; they are read from the URL, never persisted.
 */
export const NOTIFICATION_STATE_PARAM = "notify";
export const NOTIFICATION_STATE_VALUES = {
  denied: "denied",
  channelOff: "channel-off",
  quiet: "quiet",
} as const;
