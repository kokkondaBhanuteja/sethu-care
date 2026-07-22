// The alert vocabulary (Admin spec §6.20, §6.21 and the §8 escalation engine that produces them).
//
// Severity is deliberately three values, not the spec's five labels: the design only ever draws
// three visual tiers (shout / warn / file away), and a fourth tone would be a distinction the
// operator cannot see. §8.1's High and Medium triggers both land on `warning`.

export const ALERT_SEVERITIES = {
  critical: "critical",
  warning: "warning",
  informational: "informational",
} as const;

export type AlertSeverity = (typeof ALERT_SEVERITIES)[keyof typeof ALERT_SEVERITIES];

/** Alert types the console can render. Mirrors the §6.20 alert-type table. */
export const ALERT_TYPES = {
  bookingEscalated: "bookingEscalated",
  assignmentFailed: "assignmentFailed",
  slaAtRisk: "slaAtRisk",
  slaBreached: "slaBreached",
  newApplication: "newApplication",
  providerAutoSuspended: "providerAutoSuspended",
  lowRating: "lowRating",
  paymentFailed: "paymentFailed",
  dailySummary: "dailySummary",
} as const;

export type AlertType = (typeof ALERT_TYPES)[keyof typeof ALERT_TYPES];

/**
 * Interpolation values for the alert's headline. The type supplies the sentence and the server
 * supplies the nouns, so "New application — Ajay Verma" translates without the server knowing a
 * word of Telugu.
 */
export interface AlertTitleParams {
  readonly name?: string;
  readonly reference?: string;
  readonly rating?: string;
  readonly date?: string;
  /** i18next interpolates by key; the index signature is what lets these be passed straight to t(). */
  readonly [placeholder: string]: string | undefined;
}

export const ALERT_SUBJECT_KINDS = {
  booking: "booking",
  provider: "provider",
} as const;

export type AlertSubjectKind = (typeof ALERT_SUBJECT_KINDS)[keyof typeof ALERT_SUBJECT_KINDS];

/** The record an alert is about — the only thing Alert Detail knows how to navigate to. */
export interface AlertSubject {
  readonly kind: AlertSubjectKind;
  readonly id: string;
  /** The human reference the design prints in mono, e.g. `#B-8823`. */
  readonly reference: string;
}

export interface AlertAcknowledgement {
  readonly adminId: string;
  readonly adminName: string;
  readonly acknowledgedAt: string;
}

export interface Alert {
  readonly id: string;
  readonly type: AlertType;
  readonly severity: AlertSeverity;
  readonly titleParams: AlertTitleParams;
  /** Server-composed supporting line: ids, services and zones the client cannot assemble. */
  readonly summary: string;
  readonly createdAt: string;
  /** §6.20: only the critical tier claims ownership. Everything else is a notification. */
  readonly requiresAcknowledgement: boolean;
  readonly acknowledgement: AlertAcknowledgement | null;
  readonly subject: AlertSubject | null;
}

/** The rule audit: what fired, what the line was, and what the reading actually was (§6.21). */
export interface AlertTrigger {
  readonly rule: string;
  readonly threshold: string;
  readonly actual: string;
}

export interface AlertNote {
  readonly id: string;
  readonly body: string;
  readonly authorName: string;
  readonly createdAt: string;
}

export interface RelatedAlertLink {
  readonly id: string;
  readonly severity: AlertSeverity;
  readonly type: AlertType;
  readonly titleParams: AlertTitleParams;
  readonly createdAt: string;
}

/** Tones the related-record pill may take. A subset of the Pill primitive's tones, on purpose. */
export type RecordStatusTone = "danger" | "warning" | "success" | "neutral";

export interface RelatedRecord {
  readonly kind: AlertSubjectKind;
  readonly id: string;
  readonly reference: string;
  readonly title: string;
  readonly subtitle: string;
  readonly createdLine: string;
  readonly amountPaise: number | null;
  readonly statusLabel: string;
  readonly statusTone: RecordStatusTone;
}

/** Tones a dispatch-history entry may take. A subset of the Timeline primitive's tones. */
export type AlertHistoryTone = "info" | "danger" | "neutral";

export interface AlertHistoryEntry {
  readonly id: string;
  readonly at: string;
  readonly body: string;
  readonly tone: AlertHistoryTone;
}

export interface AlertDetail extends Alert {
  readonly description: string;
  readonly trigger: AlertTrigger;
  /** §6.21: mute is offered but critical types cannot be muted, and the ceiling is shown up front. */
  readonly canMute: boolean;
  readonly relatedRecord: RelatedRecord | null;
  readonly relatedAlerts: readonly RelatedAlertLink[];
  readonly history: readonly AlertHistoryEntry[];
  readonly notes: readonly AlertNote[];
}

/**
 * Acknowledgement is idempotent (docs/admin-api-contract.md). A second writer is not an error —
 * it gets the winning acknowledgement back and `wonRace: false`, which is the design's
 * "acknowledged by someone else" state rather than a failure toast.
 */
export interface AcknowledgeResult {
  readonly alert: Alert;
  readonly wonRace: boolean;
}
