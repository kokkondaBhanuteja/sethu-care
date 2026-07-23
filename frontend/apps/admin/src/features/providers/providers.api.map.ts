// Pure mappers from the generated /ops/providers payloads (@sethu/api-client) onto this feature's
// normative shapes in providers.types.ts. Every field is copied explicitly so a contract drift is
// a compile error here rather than a rendering surprise.

import type {
  ActiveJobStage as ApiActiveJobStage,
  DocumentType as ApiDocumentType,
  ProviderActiveJob as ApiProviderActiveJob,
  ProviderCurrentJob as ApiProviderCurrentJob,
  ProviderDocument as ApiProviderDocument,
  ProviderFlag as ApiProviderFlag,
  ProviderProfile as ApiProviderProfile,
  ProviderRoster as ApiProviderRoster,
  ProviderRosterRow as ApiProviderRosterRow,
} from "@sethu/api-client";

import { DOCUMENT_TYPE_KEYS } from "./providers.types";
import type {
  DocumentTypeKey,
  ProviderDocument,
  ProviderProfile,
  ProviderRoster,
  ProviderRosterRow,
  RosterSegment,
} from "./providers.types";
import { ACTIVE_JOB_STAGES } from "./suspend.types";
import type { ProviderActiveJob } from "./suspend.types";

/** The server caps page size at 100; the roster has no pager, so one full page is fetched. */
export const ROSTER_FETCH_CAP = 100;

export interface ListProvidersParams {
  readonly segment: RosterSegment;
  readonly search?: string;
  readonly limit: number;
}

export function toListProvidersParams(request: {
  segment: RosterSegment;
  search: string;
}): ListProvidersParams {
  return {
    segment: request.segment,
    // There is no zone query param — zone filtering rides the free-text search (contract note).
    ...(request.search.length > 0 ? { search: request.search } : {}),
    limit: ROSTER_FETCH_CAP,
  };
}

/** Wire document-type codes → the fixed i18n vocabulary (providers.types.ts). */
const DOCUMENT_TYPE_KEY_FOR: Readonly<Record<ApiDocumentType, DocumentTypeKey>> = {
  AADHAAR: DOCUMENT_TYPE_KEYS.aadhaar,
  AADHAAR_CARD: DOCUMENT_TYPE_KEYS.aadhaarCard,
  PAN: DOCUMENT_TYPE_KEYS.pan,
  DRIVING_LICENCE: DOCUMENT_TYPE_KEYS.drivingLicence,
  SKILL_CERTIFICATE: DOCUMENT_TYPE_KEYS.skillCertificate,
  ELECTRICAL_CERTIFICATE: DOCUMENT_TYPE_KEYS.electricalCertificate,
  POLICE_VERIFICATION: DOCUMENT_TYPE_KEYS.policeVerification,
  BANK_PASSBOOK: DOCUMENT_TYPE_KEYS.bankPassbook,
  BANK_DETAILS: DOCUMENT_TYPE_KEYS.bankDetails,
};

export function documentTypeKeyFor(type: ApiDocumentType): DocumentTypeKey {
  return DOCUMENT_TYPE_KEY_FOR[type];
}

/**
 * The roster row's stage line. The server sends structured data and the console owns the wording
 * (English-only in practice, spec §4.7 — the bookings payment-method precedent). A null
 * etaMinutes is honest "no location data": the label simply carries no ETA.
 */
const STAGE_LABELS: Readonly<Record<ApiActiveJobStage, string>> = {
  [ACTIVE_JOB_STAGES.enRoute]: "En route",
  [ACTIVE_JOB_STAGES.inProgress]: "In progress",
};

export function stageLabelFor(currentJob: ApiProviderCurrentJob): string {
  const base = STAGE_LABELS[currentJob.stage];
  if (currentJob.stage === ACTIVE_JOB_STAGES.enRoute && currentJob.etaMinutes !== null) {
    return `${base} · ETA ${currentJob.etaMinutes}m`;
  }
  return base;
}

export function mapRosterRow(row: ApiProviderRosterRow): ProviderRosterRow {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    skills: [...row.skills],
    zone: row.zone,
    jobsToday: row.jobsToday,
    earningsTodayPaise: row.earningsTodayPaise,
    rating: row.rating,
    completionRate: row.completionRate,
    lastSeenAt: row.lastSeenAt,
    ...(row.currentJob
      ? {
          currentJob: {
            bookingId: row.currentJob.bookingId,
            stageLabel: stageLabelFor(row.currentJob),
          },
        }
      : {}),
    ...(row.suspendedUntil !== undefined ? { suspendedUntil: row.suspendedUntil } : {}),
  };
}

export function mapProviderRoster(payload: ApiProviderRoster): ProviderRoster {
  return {
    rows: payload.rows.map(mapRosterRow),
    counts: {
      total: payload.counts.total,
      online: payload.counts.online,
      onJob: payload.counts.onJob,
      suspended: payload.counts.suspended,
    },
    shortfall: payload.shortfall
      ? {
          zone: payload.shortfall.zone,
          onlineCount: payload.shortfall.onlineCount,
          threshold: payload.shortfall.threshold,
        }
      : null,
    pendingApplications: payload.pendingApplications,
    oldestApplicationDays: payload.oldestApplicationDays,
    statusesAsOf: payload.statusesAsOf,
  };
}

export function mapProviderDocument(document: ApiProviderDocument): ProviderDocument {
  return {
    id: document.id,
    typeKey: documentTypeKeyFor(document.type),
    state: document.state,
    ...(document.expiresAt !== undefined ? { expiresAt: document.expiresAt } : {}),
    ...(document.daysToExpiry !== undefined ? { daysToExpiry: document.daysToExpiry } : {}),
  };
}

/**
 * Structured flags → the profile's free-text lines ("2 late arrivals in 30 days"). The live
 * backend sends [] today (no backing table — honest empty); mapped anyway so the vocabulary is
 * complete the day the table lands. Console-owned English wording, per the stage-label precedent.
 */
const FLAG_PHRASES: Readonly<Record<ApiProviderFlag["code"], string>> = {
  late_arrival: "late arrivals",
  cancellation: "cancellations",
  customer_complaint: "customer complaints",
  low_rating: "low ratings",
  no_show: "no-shows",
  document_expiring: "documents expiring",
};

export function flagLineFor(flag: ApiProviderFlag): string {
  return `${flag.count} ${FLAG_PHRASES[flag.code]} in ${flag.windowDays} days`;
}

export function mapProviderProfile(payload: ApiProviderProfile): ProviderProfile {
  return {
    id: payload.id,
    name: payload.name,
    phone: payload.phone,
    status: payload.status,
    isVerified: payload.isVerified,
    rating: payload.rating,
    jobsTotal: payload.jobsTotal,
    joinedAt: payload.joinedAt,
    zone: payload.zone,
    zones: [...payload.zones],
    jobsToday: payload.jobsToday,
    earningsTodayPaise: payload.earningsTodayPaise,
    skills: payload.skills.map((skill) => ({
      name: skill.name,
      isPending: skill.isPending,
      ...(skill.certifiedTo !== undefined ? { certifiedTo: skill.certifiedTo } : {}),
    })),
    documents: payload.documents.map(mapProviderDocument),
    metrics: payload.metrics.map((metric) => ({
      id: metric.id,
      value: metric.value,
      unit: metric.unit,
      band: metric.band,
      trend: [...metric.trend],
    })),
    recentJobs: payload.recentJobs.map((job) => ({
      bookingId: job.bookingId,
      service: job.service,
      at: job.at,
      isCancelled: job.isCancelled,
      rating: job.rating,
      amountPaise: job.amountPaise,
    })),
    feedback: payload.feedback.map((entry) => ({
      id: entry.id,
      rating: entry.rating,
      comment: entry.comment,
      author: entry.author,
      at: entry.at,
    })),
    flags: payload.flags.map(flagLineFor),
    payoutCyclePaise: payload.payoutCyclePaise,
    ...(payload.suspension
      ? {
          suspension: {
            until: payload.suspension.until,
            reasonCode: payload.suspension.reasonCode,
            byName: payload.suspension.byName,
          },
        }
      : {}),
    ...(payload.offboardedAt !== undefined ? { offboardedAt: payload.offboardedAt } : {}),
    version: payload.version,
  };
}

export function mapProviderActiveJob(job: ApiProviderActiveJob): ProviderActiveJob {
  return {
    bookingId: job.bookingId,
    stage: job.stage,
    service: job.service,
    customerName: job.customerName,
    zone: job.zone,
    amountPaise: job.amountPaise,
    ...(job.etaMinutes !== undefined ? { etaMinutes: job.etaMinutes } : {}),
    ...(job.startedAt !== undefined ? { startedAt: job.startedAt } : {}),
    suggestedProviderName: job.suggestedProviderName,
  };
}
