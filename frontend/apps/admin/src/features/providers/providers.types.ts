// Shapes the providers feature exchanges with its data boundary (`providers.api.ts`).
//
// These types are normative until the backend ships the endpoints listed in
// docs/admin-api-contract.md § MISSING — providers. Catalogue values that the backend owns
// (skill names, zone names, service names) stay plain strings: they are data, not UI copy.

import type { SuspendReasonCode } from "./suspend.types";

/** Dispatchability, in the vocabulary the roster and the profile both read. */
export const PROVIDER_STATUSES = {
  free: "free",
  onJob: "on_job",
  offline: "offline",
  suspended: "suspended",
  offboarded: "offboarded",
} as const;

export type ProviderStatus = (typeof PROVIDER_STATUSES)[keyof typeof PROVIDER_STATUSES];

/** Which slice of the roster is on screen (spec §6.15). */
export const ROSTER_SEGMENTS = {
  online: "online",
  onJob: "onJob",
  all: "all",
} as const;

export type RosterSegment = (typeof ROSTER_SEGMENTS)[keyof typeof ROSTER_SEGMENTS];

export interface ProviderCurrentJob {
  readonly bookingId: string;
  /** Free-text stage line the roster row shows verbatim, e.g. "En route · ETA 8m". */
  readonly stageLabel: string;
}

export interface ProviderRosterRow {
  readonly id: string;
  readonly name: string;
  readonly status: ProviderStatus;
  readonly skills: readonly string[];
  readonly zone: string;
  readonly jobsToday: number;
  readonly earningsTodayPaise: number;
  readonly rating: number;
  /** 0–1. Coloured against the §6.16 completion thresholds — the table's only coloured number. */
  readonly completionRate: number;
  /** RFC 3339. Null means "reporting right now". */
  readonly lastSeenAt: string | null;
  readonly currentJob?: ProviderCurrentJob;
  readonly suspendedUntil?: string;
}

export interface ZoneSupply {
  readonly zone: string;
  readonly onlineCount: number;
  readonly threshold: number;
}

export interface RosterCounts {
  readonly total: number;
  readonly online: number;
  readonly onJob: number;
  readonly suspended: number;
}

export interface ProviderRoster {
  readonly rows: readonly ProviderRosterRow[];
  readonly counts: RosterCounts;
  /** The worst zone below threshold, or null when every zone is at or above it (BOX 21 / M35). */
  readonly shortfall: ZoneSupply | null;
  readonly pendingApplications: number;
  readonly oldestApplicationDays: number;
  /** When the live statuses were last confirmed — the offline state ages them (M36). */
  readonly statusesAsOf: string;
}

/** Where a metric sits against its §6.16 target. Colour is an addition to the label, never a swap. */
export const METRIC_BANDS = { good: "good", watch: "watch", poor: "poor" } as const;
export type MetricBand = (typeof METRIC_BANDS)[keyof typeof METRIC_BANDS];

export const PROVIDER_METRICS = {
  completion: "completion",
  escalation: "escalation",
  cancellation: "cancellation",
  rating: "rating",
  onTime: "onTime",
  jobs30: "jobs30",
} as const;

export type ProviderMetricId = (typeof PROVIDER_METRICS)[keyof typeof PROVIDER_METRICS];

export const METRIC_UNITS = { percent: "percent", rating: "rating", count: "count" } as const;
export type MetricUnit = (typeof METRIC_UNITS)[keyof typeof METRIC_UNITS];

export interface ProviderMetric {
  readonly id: ProviderMetricId;
  /** Percent metrics arrive as a fraction; the tile formats through `lib/format`. */
  readonly value: number;
  readonly unit: MetricUnit;
  readonly band: MetricBand;
  /** Eight points describing the 90-day trend. */
  readonly trend: readonly number[];
}

/**
 * Document types are a fixed platform vocabulary, so each one carries its i18n key rather than a
 * backend-supplied display name that could never be translated.
 */
export const DOCUMENT_TYPE_KEYS = {
  aadhaar: "document.aadhaar",
  aadhaarCard: "document.aadhaarCard",
  pan: "document.pan",
  drivingLicence: "document.drivingLicence",
  skillCertificate: "document.skillCertificate",
  electricalCertificate: "document.electricalCertificate",
  policeVerification: "document.policeVerification",
  bankPassbook: "document.bankPassbook",
  bankDetails: "document.bankDetails",
} as const;

export type DocumentTypeKey = (typeof DOCUMENT_TYPE_KEYS)[keyof typeof DOCUMENT_TYPE_KEYS];

export const DOCUMENT_STATES = {
  verified: "verified",
  expiring: "expiring",
  expired: "expired",
} as const;

export type DocumentState = (typeof DOCUMENT_STATES)[keyof typeof DOCUMENT_STATES];

export interface ProviderDocument {
  readonly id: string;
  readonly typeKey: DocumentTypeKey;
  readonly state: DocumentState;
  readonly expiresAt?: string;
  readonly daysToExpiry?: number;
}

export interface ProviderSkill {
  readonly name: string;
  readonly isPending: boolean;
  readonly certifiedTo?: string;
}

export interface ProviderJob {
  readonly bookingId: string;
  readonly service: string;
  readonly at: string;
  readonly isCancelled: boolean;
  readonly rating: number | null;
  readonly amountPaise: number;
}

export interface ProviderFeedback {
  readonly id: string;
  readonly rating: number;
  readonly comment: string;
  readonly author: string;
  readonly at: string;
}

export interface ProviderSuspension {
  readonly until: string;
  readonly reasonCode: SuspendReasonCode;
  readonly byName: string;
}

export interface ProviderProfile {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly status: ProviderStatus;
  readonly isVerified: boolean;
  readonly rating: number;
  readonly jobsTotal: number;
  readonly joinedAt: string;
  readonly zone: string;
  readonly zones: readonly string[];
  readonly jobsToday: number;
  readonly earningsTodayPaise: number;
  readonly skills: readonly ProviderSkill[];
  readonly documents: readonly ProviderDocument[];
  readonly metrics: readonly ProviderMetric[];
  readonly recentJobs: readonly ProviderJob[];
  readonly feedback: readonly ProviderFeedback[];
  /** Free-text flag lines, e.g. "2 late arrivals in 30 days". */
  readonly flags: readonly string[];
  readonly payoutCyclePaise: number;
  readonly suspension?: ProviderSuspension;
  readonly offboardedAt?: string;
  /** Optimistic-concurrency token echoed back on every mutation (API contract). */
  readonly version: number;
}
