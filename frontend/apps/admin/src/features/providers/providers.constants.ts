// Query keys, vocabularies and the copy lookups the providers feature shares between screens.
//
// Nothing here restates a permission, step-up or undo policy: those live in
// `lib/permissions/actions.ts` and are read through `useActionPolicy` / `useStepUp` /
// `useUndoableAction`. What lives here is product vocabulary and query identity.

import { METRIC_BANDS, PROVIDER_METRICS, ROSTER_SEGMENTS } from "./providers.types";
import type { MetricBand, ProviderMetricId, RosterSegment } from "./providers.types";
import { APPLICATION_SEGMENTS, REJECT_REASON_CODES } from "./applications.types";
import type { ApplicationSegment, RejectReasonCode } from "./applications.types";
import { SUSPEND_ACTION_TYPES, SUSPEND_REASON_CODES } from "./suspend.types";
import type { SuspendActionType, SuspendReasonCode } from "./suspend.types";

export const PROVIDER_QUERY_KEYS = {
  roster: (segment: RosterSegment, search: string) =>
    ["providers", "roster", segment, search] as const,
  profile: (providerId: string) => ["providers", "profile", providerId] as const,
  activeJobs: (providerId: string) => ["providers", "activeJobs", providerId] as const,
  applications: (segment: ApplicationSegment) => ["providers", "applications", segment] as const,
  application: (applicationId: string) => ["providers", "application", applicationId] as const,
} as const;

export const ROSTER_SEGMENT_ORDER: readonly RosterSegment[] = [
  ROSTER_SEGMENTS.online,
  ROSTER_SEGMENTS.onJob,
  ROSTER_SEGMENTS.all,
];

export const ROSTER_SEGMENT_LABEL_KEYS = {
  [ROSTER_SEGMENTS.online]: "roster.segmentOnline",
  [ROSTER_SEGMENTS.onJob]: "roster.segmentOnJob",
  [ROSTER_SEGMENTS.all]: "roster.segmentAll",
} as const;

export const APPLICATION_SEGMENT_ORDER: readonly ApplicationSegment[] = [
  APPLICATION_SEGMENTS.pending,
  APPLICATION_SEGMENTS.awaitingDocs,
  APPLICATION_SEGMENTS.decided,
];

export const APPLICATION_SEGMENT_LABEL_KEYS = {
  [APPLICATION_SEGMENTS.pending]: "applications.segmentPending",
  [APPLICATION_SEGMENTS.awaitingDocs]: "applications.segmentAwaitingDocs",
  [APPLICATION_SEGMENTS.decided]: "applications.segmentDecided",
} as const;

export const SUSPEND_ACTION_ORDER: readonly SuspendActionType[] = [
  SUSPEND_ACTION_TYPES.forceOffline,
  SUSPEND_ACTION_TYPES.suspend,
  SUSPEND_ACTION_TYPES.block,
];

/** 1 / 3 / 7 / 30 days (spec §6.19 step 1). 7 is the design's default. */
export const SUSPEND_DURATIONS: readonly number[] = [1, 3, 7, 30];
export const DEFAULT_SUSPEND_DURATION_DAYS = 7;

export const SUSPEND_REASON_ORDER: readonly SuspendReasonCode[] = [
  SUSPEND_REASON_CODES.safetyComplaint,
  SUSPEND_REASON_CODES.repeatedCancellations,
  SUSPEND_REASON_CODES.poorQuality,
  SUSPEND_REASON_CODES.fraudSuspected,
  SUSPEND_REASON_CODES.documentExpired,
  SUSPEND_REASON_CODES.unprofessional,
  SUSPEND_REASON_CODES.noShowPattern,
  SUSPEND_REASON_CODES.policyViolation,
  SUSPEND_REASON_CODES.other,
];

export const SUSPEND_REASON_LABEL_KEYS = {
  [SUSPEND_REASON_CODES.safetyComplaint]: "reason.safetyComplaint",
  [SUSPEND_REASON_CODES.repeatedCancellations]: "reason.repeatedCancellations",
  [SUSPEND_REASON_CODES.poorQuality]: "reason.poorQuality",
  [SUSPEND_REASON_CODES.fraudSuspected]: "reason.fraudSuspected",
  [SUSPEND_REASON_CODES.documentExpired]: "reason.documentExpired",
  [SUSPEND_REASON_CODES.unprofessional]: "reason.unprofessional",
  [SUSPEND_REASON_CODES.noShowPattern]: "reason.noShowPattern",
  [SUSPEND_REASON_CODES.policyViolation]: "reason.policyViolation",
  [SUSPEND_REASON_CODES.other]: "reason.other",
} as const;

export const REJECT_REASON_ORDER: readonly RejectReasonCode[] = [
  REJECT_REASON_CODES.incompleteDocumentation,
  REJECT_REASON_CODES.failedBackgroundCheck,
  REJECT_REASON_CODES.insufficientExperience,
  REJECT_REASON_CODES.outsideServiceArea,
  REJECT_REASON_CODES.duplicateApplication,
  REJECT_REASON_CODES.authenticityConcern,
  REJECT_REASON_CODES.capacityFull,
  REJECT_REASON_CODES.other,
];

export const REJECT_REASON_LABEL_KEYS = {
  [REJECT_REASON_CODES.incompleteDocumentation]: "rejectReason.incompleteDocumentation",
  [REJECT_REASON_CODES.failedBackgroundCheck]: "rejectReason.failedBackgroundCheck",
  [REJECT_REASON_CODES.insufficientExperience]: "rejectReason.insufficientExperience",
  [REJECT_REASON_CODES.outsideServiceArea]: "rejectReason.outsideServiceArea",
  [REJECT_REASON_CODES.duplicateApplication]: "rejectReason.duplicateApplication",
  [REJECT_REASON_CODES.authenticityConcern]: "rejectReason.authenticityConcern",
  [REJECT_REASON_CODES.capacityFull]: "rejectReason.capacityFull",
  [REJECT_REASON_CODES.other]: "rejectReason.other",
} as const;

export const PROVIDER_METRIC_LABEL_KEYS = {
  [PROVIDER_METRICS.completion]: "profile.metricCompletion",
  [PROVIDER_METRICS.escalation]: "profile.metricEscalation",
  [PROVIDER_METRICS.cancellation]: "profile.metricCancellation",
  [PROVIDER_METRICS.rating]: "profile.metricRating",
  [PROVIDER_METRICS.onTime]: "profile.metricOnTime",
  [PROVIDER_METRICS.jobs30]: "profile.metricJobs30",
} as const;

/** Rejection notes are sometimes contested, so the backend enforces a floor (spec §6.18). */
export const REJECT_NOTE_MINIMUM = 20;
export const REJECT_NOTE_MAXIMUM = 500;
export const SUSPEND_NOTE_MAXIMUM = 500;

/** First-decision SLA for an application (spec §6.17). */
export const APPLICATION_SLA_HOURS = 48;

/** A live status older than this is a wrong answer, not stale detail (M36). */
export const STATUS_STALE_AFTER_MS = 5 * 60 * 1000;

/** Completion-rate bands from spec §6.16, applied to the roster's one coloured column. */
export function completionBand(rate: number): MetricBand {
  if (rate >= 0.95) return METRIC_BANDS.good;
  if (rate >= 0.85) return METRIC_BANDS.watch;
  return METRIC_BANDS.poor;
}

export function metricLabelKey(id: ProviderMetricId): string {
  return PROVIDER_METRIC_LABEL_KEYS[id];
}
