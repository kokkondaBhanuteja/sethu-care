// Pure mappers from the generated /ops/alerts payloads (@sethu/api-client) onto this feature's
// normative shapes in alerts.types.ts. Every field is copied explicitly so a contract drift is a
// compile error here rather than a rendering surprise.
//
// Where the server sends CODES (the trigger rule, the dispatch-history events), the console owns
// the wording — composed here as data, English-only in practice (spec §4.7), exactly as the
// dashboard mapper composes the attention reason line. When this feature grows a localisation
// path for server data, these label maps are what move behind it.

import type {
  Alert as ApiAlert,
  AlertDetail as ApiAlertDetail,
  AlertHistoryEntry as ApiAlertHistoryEntry,
  AlertNote as ApiAlertNote,
  AlertSummaryParams as ApiAlertSummaryParams,
  AlertTitleParams as ApiAlertTitleParams,
  AlertTrigger as ApiAlertTrigger,
  AcknowledgeAlertResult as ApiAcknowledgeAlertResult,
  BookingState as ApiBookingState,
  ProviderStatus as ApiProviderStatus,
  RelatedAlertLink as ApiRelatedAlertLink,
  RelatedRecord as ApiRelatedRecord,
} from "@sethu/api-client";

import { formatAlertTime } from "./alerts.time";
import type {
  AcknowledgeResult,
  Alert,
  AlertDetail,
  AlertHistoryEntry,
  AlertNote,
  AlertTitleParams,
  AlertTrigger,
  RecordStatusTone,
  RelatedAlertLink,
  RelatedRecord,
} from "./alerts.types";

/** The server caps page size at 100. The feed is one fetch; tiers are split client-side. */
export const ALERTS_FETCH_CAP = 100;

/** The i18n interpolation values, narrowed: the generated index signature admits `unknown`. */
export function mapAlertParams(
  params: ApiAlertTitleParams | ApiAlertSummaryParams,
): AlertTitleParams {
  return Object.fromEntries(
    Object.entries(params).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

/**
 * The feed row's supporting line. The server sends the nouns (`reference`/`service`/`zone`) and
 * the console joins whichever are present — zones do not exist yet, so `zone` arriving as "" must
 * simply vanish rather than leave a dangling separator.
 */
export function composeAlertSummary(params: ApiAlertSummaryParams): string {
  const { reference, service, zone } = mapAlertParams(params);
  return [reference, service, zone].filter((fragment) => fragment).join(" · ");
}

/** The §8 engine's rule codes, worded for the trigger audit. Unknown codes pass through honestly. */
const TRIGGER_RULE_LABELS: Readonly<Record<string, string>> = {
  "booking.escalated": "Booking escalated to ops",
};

export function mapTrigger(trigger: ApiAlertTrigger): AlertTrigger {
  return {
    rule: TRIGGER_RULE_LABELS[trigger.rule] ?? trigger.rule,
    // Threshold and actual are state expressions ("state = ESCALATED", "SEARCHING → ESCALATED");
    // the card renders them mono, where an audit reading is exactly what they should look like.
    threshold: trigger.threshold,
    actual: trigger.actual,
  };
}

/** Dispatch-history events arrive as `EVENT: FROM → TO` codes; the console words the event. */
const HISTORY_EVENT_LABELS: Readonly<Record<string, string>> = {
  CONFIRM: "Booking confirmed",
  SEARCH: "Provider search started",
  ESCALATE: "Escalated to ops",
  ASSIGN: "Provider assigned",
  CANCEL: "Booking cancelled",
};

export function mapHistoryEntry(entry: ApiAlertHistoryEntry): AlertHistoryEntry {
  const eventCode = entry.body.split(":")[0] ?? "";
  return {
    id: entry.id,
    at: entry.at,
    body: HISTORY_EVENT_LABELS[eventCode] ?? entry.body,
    tone: entry.tone,
  };
}

/** The record pill's word + tone per booking state. The word always ships with the colour (§4.8). */
const BOOKING_STATE_PRESENTATION: Readonly<
  Record<ApiBookingState, { label: string; tone: RecordStatusTone }>
> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  CONFIRMED: { label: "Confirmed", tone: "neutral" },
  SEARCHING: { label: "Searching", tone: "warning" },
  ASSIGNED: { label: "Assigned", tone: "neutral" },
  EN_ROUTE: { label: "En route", tone: "neutral" },
  ARRIVED: { label: "Arrived", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "neutral" },
  AWAITING_COMPLETION: { label: "Awaiting completion", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  ESCALATED: { label: "Escalated", tone: "danger" },
  RESCHEDULED: { label: "Rescheduled", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  FAILED: { label: "Failed", tone: "danger" },
};

const PROVIDER_STATUS_PRESENTATION: Readonly<
  Record<ApiProviderStatus, { label: string; tone: RecordStatusTone }>
> = {
  free: { label: "Free", tone: "success" },
  on_job: { label: "On a job", tone: "neutral" },
  offline: { label: "Offline", tone: "neutral" },
  suspended: { label: "Suspended", tone: "danger" },
  offboarded: { label: "Offboarded", tone: "neutral" },
};

export function mapRelatedRecord(record: ApiRelatedRecord): RelatedRecord {
  const status = (record.bookingState ? BOOKING_STATE_PRESENTATION[record.bookingState] : null) ??
    (record.providerStatus ? PROVIDER_STATUS_PRESENTATION[record.providerStatus] : null) ?? {
      label: "—",
      tone: "neutral" as RecordStatusTone,
    };
  return {
    kind: record.kind,
    id: record.id,
    reference: record.reference,
    title: record.title,
    subtitle: record.subtitle,
    createdLine: `Created ${formatAlertTime(record.createdAt)}`,
    amountPaise: record.amountPaise,
    statusLabel: status.label,
    statusTone: status.tone,
  };
}

export function mapAlert(payload: ApiAlert): Alert {
  return {
    id: payload.id,
    type: payload.type,
    severity: payload.severity,
    titleParams: mapAlertParams(payload.titleParams),
    summary: composeAlertSummary(payload.summaryParams),
    createdAt: payload.createdAt,
    requiresAcknowledgement: payload.requiresAcknowledgement,
    acknowledgement: payload.acknowledgement
      ? {
          adminId: payload.acknowledgement.adminId,
          adminName: payload.acknowledgement.adminName,
          acknowledgedAt: payload.acknowledgement.acknowledgedAt,
        }
      : null,
    subject: payload.subject
      ? { kind: payload.subject.kind, id: payload.subject.id, reference: payload.subject.reference }
      : null,
  };
}

export function mapRelatedAlertLink(link: ApiRelatedAlertLink): RelatedAlertLink {
  return {
    id: link.id,
    severity: link.severity,
    type: link.type,
    titleParams: mapAlertParams(link.titleParams),
    createdAt: link.createdAt,
  };
}

export function mapAlertNote(note: ApiAlertNote): AlertNote {
  return { id: note.id, body: note.body, authorName: note.authorName, createdAt: note.createdAt };
}

export function mapAlertDetail(payload: ApiAlertDetail): AlertDetail {
  return {
    ...mapAlert(payload),
    // The one server-composed English line; everything else the console words itself.
    description: payload.description,
    trigger: mapTrigger(payload.trigger),
    canMute: payload.canMute,
    relatedRecord: payload.relatedRecord ? mapRelatedRecord(payload.relatedRecord) : null,
    relatedAlerts: payload.relatedAlerts.map(mapRelatedAlertLink),
    history: payload.history.map(mapHistoryEntry),
    notes: payload.notes.map(mapAlertNote),
  };
}

export function mapAcknowledgeResult(payload: ApiAcknowledgeAlertResult): AcknowledgeResult {
  return { alert: mapAlert(payload.alert), wonRace: payload.wonRace };
}
