// Query keys and the severity → look mapping, declared once.
//
// Colour is never the only signal (spec §4.8): every place a tone below is applied, the severity's
// WORD is rendered next to it. The maps exist so "critical is red" is stated in exactly one file.

import {
  AlertTriangle,
  BellRing,
  Clock,
  CreditCard,
  FileText,
  Star,
  UserPlus,
  UserX,
  type LucideIcon,
} from "lucide-react";

import type { CardEdge, CardTone } from "../../components/ui/Card";
import type { PillTone } from "../../components/ui/Pill";
import { ALERT_SEVERITIES, ALERT_TYPES, type AlertSeverity, type AlertType } from "./alerts.types";

export const ALERTS_QUERY_KEYS = {
  root: ["alerts"] as const,
  feed: () => ["alerts", "feed"] as const,
  detail: (alertId: string) => ["alerts", "detail", alertId] as const,
};

export const SEVERITY_PILL_TONES: Readonly<Record<AlertSeverity, PillTone>> = {
  [ALERT_SEVERITIES.critical]: "danger",
  [ALERT_SEVERITIES.warning]: "warning",
  [ALERT_SEVERITIES.informational]: "neutral",
};

/** The 3px left rail. Informational alerts get none — a rail is a claim on attention. */
export const SEVERITY_CARD_EDGES: Readonly<Record<AlertSeverity, CardEdge>> = {
  [ALERT_SEVERITIES.critical]: "danger",
  [ALERT_SEVERITIES.warning]: "warning",
  [ALERT_SEVERITIES.informational]: "none",
};

/** The faint tint a needs-action card carries while it is still unacknowledged. */
export const SEVERITY_CARD_TINTS: Readonly<Record<AlertSeverity, CardTone>> = {
  [ALERT_SEVERITIES.critical]: "tintDanger",
  [ALERT_SEVERITIES.warning]: "tintWarning",
  [ALERT_SEVERITIES.informational]: "plain",
};

/** The solid block the detail screen's severity header uses (mobile BOX 38). */
export const SEVERITY_HEADER_TONES: Readonly<Record<AlertSeverity, CardTone>> = {
  [ALERT_SEVERITIES.critical]: "danger",
  [ALERT_SEVERITIES.warning]: "warning",
  [ALERT_SEVERITIES.informational]: "surface",
};

/** Icon ink. Token-backed utilities, so no severity colour is written twice. */
export const SEVERITY_INK: Readonly<Record<AlertSeverity, string>> = {
  [ALERT_SEVERITIES.critical]: "text-danger",
  [ALERT_SEVERITIES.warning]: "text-warning",
  [ALERT_SEVERITIES.informational]: "text-text-3",
};

/** Severity label keys. The word always ships with the colour. */
export const SEVERITY_LABEL_KEYS = {
  [ALERT_SEVERITIES.critical]: "severity.critical",
  [ALERT_SEVERITIES.warning]: "severity.warning",
  [ALERT_SEVERITIES.informational]: "severity.informational",
} as const;

export type SeverityLabelKey = (typeof SEVERITY_LABEL_KEYS)[AlertSeverity];

/** Headline sentence per type — the client owns the words, the server owns the nouns. */
export const ALERT_TITLE_KEYS = {
  [ALERT_TYPES.bookingEscalated]: "types.bookingEscalated",
  [ALERT_TYPES.assignmentFailed]: "types.assignmentFailed",
  [ALERT_TYPES.slaAtRisk]: "types.slaAtRisk",
  [ALERT_TYPES.slaBreached]: "types.slaBreached",
  [ALERT_TYPES.newApplication]: "types.newApplication",
  [ALERT_TYPES.providerAutoSuspended]: "types.providerAutoSuspended",
  [ALERT_TYPES.lowRating]: "types.lowRating",
  [ALERT_TYPES.paymentFailed]: "types.paymentFailed",
  [ALERT_TYPES.dailySummary]: "types.dailySummary",
} as const;

export type AlertTitleKey = (typeof ALERT_TITLE_KEYS)[AlertType];

/** The drawn glyph per type — the artifacts use Lucide geometry, so these match one-for-one. */
export const ALERT_TYPE_ICONS: Readonly<Record<AlertType, LucideIcon>> = {
  [ALERT_TYPES.bookingEscalated]: BellRing,
  [ALERT_TYPES.assignmentFailed]: AlertTriangle,
  [ALERT_TYPES.slaAtRisk]: Clock,
  [ALERT_TYPES.slaBreached]: Clock,
  [ALERT_TYPES.newApplication]: UserPlus,
  [ALERT_TYPES.providerAutoSuspended]: UserX,
  [ALERT_TYPES.lowRating]: Star,
  [ALERT_TYPES.paymentFailed]: CreditCard,
  [ALERT_TYPES.dailySummary]: FileText,
};

/** Desktop chip row: All, then one chip per severity, in descending urgency (BOX 13). */
export const SEVERITY_FILTER_ALL = "all" as const;

export type SeverityFilter = AlertSeverity | typeof SEVERITY_FILTER_ALL;

export const SEVERITY_FILTER_ORDER: readonly AlertSeverity[] = [
  ALERT_SEVERITIES.critical,
  ALERT_SEVERITIES.warning,
  ALERT_SEVERITIES.informational,
];

export const SEVERITY_FILTER_LABEL_KEYS = {
  [ALERT_SEVERITIES.critical]: "filters.critical",
  [ALERT_SEVERITIES.warning]: "filters.warning",
  [ALERT_SEVERITIES.informational]: "filters.informational",
} as const;

/** Informational alerts are grouped by day (§6.20); the design draws exactly two buckets. */
export const TODAY_GROUP = "today" as const;
export const EARLIER_GROUP = "earlier" as const;
