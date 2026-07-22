// Feed fixtures for `GET /ops/alerts` and `POST /ops/alerts/{id}/acknowledge`, which the backend
// does not expose yet (docs/admin-api-contract.md). The rows mirror the approved designs exactly —
// two unacknowledged criticals (the same 2 the shell badge shows), one High, five informational —
// so a screen can be compared against its design tile directly.
//
// The store is mutable on purpose: acknowledging has to change what the next read returns, or the
// badge-discipline rule (§3.1) cannot be demonstrated at all.

import { mockRead, mockWrite } from "../../mocks/mockTransport";
import {
  ALERT_SEVERITIES,
  ALERT_SUBJECT_KINDS,
  ALERT_TYPES,
  type AcknowledgeResult,
  type Alert,
} from "./alerts.types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const BASE = Date.now();
const ago = (milliseconds: number): string => new Date(BASE - milliseconds).toISOString();

/** The admin the designs sign every action with. Replaced by the session user with the real API. */
const CURRENT_ADMIN = { id: "adm-ravi", name: "Ravi Kumar" } as const;

/** The concurrency fixture: this one is taken the instant you reach for it (spec §6.20 edge case). */
export const RACE_LOSER_ALERT_ID = "AL-8830";
const RACE_WINNER = { id: "adm-priya", name: "Priya Sharma" } as const;

const SEED: readonly Alert[] = [
  {
    id: "AL-8823",
    type: ALERT_TYPES.bookingEscalated,
    severity: ALERT_SEVERITIES.critical,
    titleParams: {},
    summary: "#B-8823 · No provider after 3 dispatch rounds",
    createdAt: ago(2 * MINUTE),
    requiresAcknowledgement: true,
    acknowledgement: null,
    subject: { kind: ALERT_SUBJECT_KINDS.booking, id: "B-8823", reference: "#B-8823" },
  },
  {
    id: RACE_LOSER_ALERT_ID,
    type: ALERT_TYPES.assignmentFailed,
    severity: ALERT_SEVERITIES.critical,
    titleParams: {},
    summary: "#B-8830 · AC Repair · Kompally",
    createdAt: ago(5 * MINUTE),
    requiresAcknowledgement: true,
    acknowledgement: null,
    subject: { kind: ALERT_SUBJECT_KINDS.booking, id: "B-8830", reference: "#B-8830" },
  },
  {
    id: "AL-SLA-8823",
    type: ALERT_TYPES.slaAtRisk,
    severity: ALERT_SEVERITIES.warning,
    titleParams: { reference: "#B-8823" },
    summary: "Assignment SLA · 4 minutes elapsed",
    createdAt: ago(7 * MINUTE),
    requiresAcknowledgement: false,
    acknowledgement: null,
    subject: { kind: ALERT_SUBJECT_KINDS.booking, id: "B-8823", reference: "#B-8823" },
  },
  {
    id: "AL-APP-1042",
    type: ALERT_TYPES.newApplication,
    severity: ALERT_SEVERITIES.informational,
    titleParams: { name: "Ajay Verma" },
    summary: "AC Repair · Miyapur",
    createdAt: ago(1 * HOUR),
    requiresAcknowledgement: false,
    acknowledgement: null,
    subject: { kind: ALERT_SUBJECT_KINDS.provider, id: "APP-1042", reference: "Ajay Verma" },
  },
  {
    id: "AL-SUS-334",
    type: ALERT_TYPES.providerAutoSuspended,
    severity: ALERT_SEVERITIES.informational,
    titleParams: { name: "Mohan Das" },
    summary: "3 consecutive no-shows",
    createdAt: ago(2 * HOUR),
    requiresAcknowledgement: false,
    acknowledgement: null,
    subject: { kind: ALERT_SUBJECT_KINDS.provider, id: "PRV-334", reference: "Mohan Das" },
  },
  {
    id: "AL-8790",
    type: ALERT_TYPES.lowRating,
    severity: ALERT_SEVERITIES.informational,
    titleParams: { rating: "1", reference: "#B-8790" },
    summary: "AC Repair · Suresh Mehta",
    createdAt: ago(3 * HOUR),
    requiresAcknowledgement: false,
    acknowledgement: null,
    subject: { kind: ALERT_SUBJECT_KINDS.booking, id: "B-8790", reference: "#B-8790" },
  },
  {
    id: "AL-8788",
    type: ALERT_TYPES.paymentFailed,
    severity: ALERT_SEVERITIES.informational,
    titleParams: { reference: "#B-8788" },
    summary: "Capture declined · retry scheduled",
    createdAt: ago(4 * HOUR),
    requiresAcknowledgement: false,
    acknowledgement: null,
    subject: { kind: ALERT_SUBJECT_KINDS.booking, id: "B-8788", reference: "#B-8788" },
  },
  {
    id: "AL-SUM-0719",
    type: ALERT_TYPES.dailySummary,
    severity: ALERT_SEVERITIES.informational,
    titleParams: { date: "19 Jul" },
    summary: "68 completed · 2 cancelled · ₹94,320 collected",
    createdAt: ago(DAY + 2 * HOUR),
    requiresAcknowledgement: false,
    acknowledgement: null,
    subject: null,
  },
];

let store: Alert[] = SEED.map((alert) => ({ ...alert }));

export function findAlertInStore(alertId: string): Alert | undefined {
  return store.find((alert) => alert.id === alertId);
}

export function fetchAlertsMock(signal?: AbortSignal): Promise<readonly Alert[]> {
  return mockRead<readonly Alert[]>(() => store, {
    ...(signal ? { signal } : {}),
    emptyValue: [],
  });
}

/**
 * Idempotent by contract: a second writer never fails. `AL-8830` models the race the spec's edge
 * case describes — first writer wins, the second is told who won (§6.20).
 */
export function acknowledgeAlertMock(
  alertId: string,
  signal?: AbortSignal,
): Promise<AcknowledgeResult> {
  return mockWrite(
    () => {
      const index = store.findIndex((alert) => alert.id === alertId);
      const existing = store[index];
      if (index < 0 || !existing) throw notFound(alertId);

      // A replayed acknowledgement this admin already won still succeeds — that is what idempotent
      // means here. Only someone else's acknowledgement is a lost race.
      if (existing.acknowledgement) {
        return {
          alert: existing,
          wonRace: existing.acknowledgement.adminId === CURRENT_ADMIN.id,
        };
      }

      const winner = alertId === RACE_LOSER_ALERT_ID ? RACE_WINNER : CURRENT_ADMIN;
      const acknowledged: Alert = {
        ...existing,
        acknowledgement: {
          adminId: winner.id,
          adminName: winner.name,
          acknowledgedAt: new Date().toISOString(),
        },
      };
      store = store.map((alert) => (alert.id === alertId ? acknowledged : alert));
      return { alert: acknowledged, wonRace: winner.id === CURRENT_ADMIN.id };
    },
    signal ? { signal } : {},
  );
}

/** "Mark read" touches the informational tier only — it can never bulk-acknowledge a critical. */
export function markInformationalReadMock(signal?: AbortSignal): Promise<number> {
  return mockWrite(
    () => store.filter((alert) => !alert.requiresAcknowledgement).length,
    signal ? { signal } : {},
  );
}

function notFound(alertId: string): Error {
  return new Error(`No alert ${alertId}`);
}
