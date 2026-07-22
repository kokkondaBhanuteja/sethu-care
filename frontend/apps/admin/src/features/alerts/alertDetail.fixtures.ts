// The hand-written context for the three alerts the approved designs actually draw (BOX 22–23,
// 38–40). Everything else in the feed is assembled generically in alertDetail.mock.ts.

import {
  ALERT_SEVERITIES,
  ALERT_SUBJECT_KINDS,
  ALERT_TYPES,
  type Alert,
  type AlertDetail,
} from "./alerts.types";

export type DetailExtras = Omit<AlertDetail, keyof Alert | "notes">;

const BASE = Date.now();
export const minutesAgo = (minutes: number): string =>
  new Date(BASE - minutes * 60_000).toISOString();

/** Reachable from a related-alert link but no longer in the live feed. */
export const ARCHIVED_ALERTS: readonly Alert[] = [
  {
    id: "AL-8742",
    type: ALERT_TYPES.lowRating,
    severity: ALERT_SEVERITIES.informational,
    titleParams: { rating: "2", reference: "#B-8742" },
    summary: "Plumbing · Ajay V.",
    createdAt: minutesAgo(275),
    requiresAcknowledgement: false,
    acknowledgement: null,
    subject: { kind: ALERT_SUBJECT_KINDS.booking, id: "B-8742", reference: "#B-8742" },
  },
];

const ESCALATED: DetailExtras = {
  description:
    "Automatic dispatch could not place this booking after three widening rounds. A human needs to assign a technician or cancel with a refund.",
  trigger: {
    rule: "Dispatch rounds exhausted",
    threshold: "3 rounds without acceptance",
    actual: "3 rounds · 25 contacted · 25 declined",
  },
  canMute: false,
  relatedRecord: {
    kind: ALERT_SUBJECT_KINDS.booking,
    id: "B-8823",
    reference: "#B-8823",
    title: "AC Repair — Deep Clean",
    subtitle: "Ravi Kumar · Kompally",
    createdLine: "Created 3:12 PM · not assigned",
    amountPaise: 149_900,
    statusLabel: "Escalated",
    statusTone: "danger",
  },
  relatedAlerts: [
    {
      id: "AL-SLA-8823",
      severity: ALERT_SEVERITIES.warning,
      type: ALERT_TYPES.slaAtRisk,
      titleParams: { reference: "#B-8823" },
      createdAt: minutesAgo(7),
    },
  ],
  history: [
    { id: "r1", at: minutesAgo(15), body: "Round 1 · 3 km · 5 declined", tone: "info" },
    { id: "r2", at: minutesAgo(12), body: "Round 2 · 4.5 km · 8 declined", tone: "info" },
    { id: "r3", at: minutesAgo(7), body: "Round 3 · 6 km · 12 declined", tone: "info" },
    { id: "r4", at: minutesAgo(2), body: "Escalated to ops", tone: "danger" },
  ],
};

const ASSIGNMENT_FAILED: DetailExtras = {
  description:
    "Every provider matching this skill in Kompally declined or was already on a job. Assign manually or re-dispatch with a wider radius.",
  trigger: {
    rule: "Repeat dispatch failure",
    threshold: "3 re-dispatch cycles all failed",
    actual: "3 cycles · 18 contacted · 18 declined",
  },
  canMute: false,
  relatedRecord: {
    kind: ALERT_SUBJECT_KINDS.booking,
    id: "B-8830",
    reference: "#B-8830",
    title: "AC Repair",
    subtitle: "Sneha K. · Kompally",
    createdLine: "Created 3:19 PM · not assigned",
    amountPaise: 129_900,
    statusLabel: "Escalated",
    statusTone: "danger",
  },
  relatedAlerts: [],
  history: [],
};

const LOW_RATING: DetailExtras = {
  description:
    "Sneha K. rated a completed AC Repair one star and opened a support ticket. Nothing is blocked — this is logged so the provider's rating trend and the ticket stay linked.",
  trigger: {
    rule: "Low rating received",
    threshold: "Rating of 2 stars or below",
    actual: "1 star · AC Repair · Suresh Mehta",
  },
  canMute: true,
  relatedRecord: {
    kind: ALERT_SUBJECT_KINDS.booking,
    id: "B-8790",
    reference: "#B-8790",
    title: "AC Repair",
    subtitle: "Sneha K. · Kompally",
    createdLine: "Completed 1:40 PM",
    amountPaise: 149_900,
    statusLabel: "Completed",
    statusTone: "success",
  },
  relatedAlerts: [
    {
      id: "AL-8742",
      severity: ALERT_SEVERITIES.informational,
      type: ALERT_TYPES.lowRating,
      titleParams: { rating: "2", reference: "#B-8742" },
      createdAt: minutesAgo(275),
    },
  ],
  history: [],
};

export const DETAIL_EXTRAS: Readonly<Record<string, DetailExtras>> = {
  "AL-8823": ESCALATED,
  "AL-8830": ASSIGNMENT_FAILED,
  "AL-8790": LOW_RATING,
};

/** Anything the designs do not draw still opens: the alert's own summary becomes its context. */
export function genericExtras(alert: Alert): DetailExtras {
  return {
    description: alert.summary,
    trigger: {
      rule: "Automatic monitor",
      threshold: "Configured in alert settings",
      actual: alert.summary,
    },
    canMute: alert.severity !== ALERT_SEVERITIES.critical,
    relatedRecord: null,
    relatedAlerts: [],
    history: [],
  };
}
