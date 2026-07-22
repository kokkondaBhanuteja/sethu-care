// The repeated parts of the profile fixtures: the two metric sets, the document set, and the job
// and feedback history the artifact draws. Split out of `providerProfiles.mock.ts` so that file
// stays about which provider is in which designed state.

import { DOCUMENT_STATES, METRIC_BANDS, METRIC_UNITS, PROVIDER_METRICS } from "./providers.types";
import type { ProviderDocument, ProviderMetric, ProviderProfile } from "./providers.types";

const RUPEE = 100;
const RISING = [15, 13, 14, 9, 10, 6, 5, 3];
const FALLING = [5, 6, 4, 8, 7, 11, 12, 15];
const FLAT = [10, 11, 9, 10, 11, 9, 10, 10];

function metric(
  id: ProviderMetric["id"],
  value: number,
  unit: ProviderMetric["unit"],
  band: ProviderMetric["band"],
  trend: readonly number[],
): ProviderMetric {
  return { id, value, unit, band, trend };
}

/** Bands follow the §6.16 thresholds; the mock stands in for the backend that will compute them. */
export const STRONG_METRICS: readonly ProviderMetric[] = [
  metric(PROVIDER_METRICS.completion, 0.96, METRIC_UNITS.percent, METRIC_BANDS.good, RISING),
  metric(PROVIDER_METRICS.escalation, 0.021, METRIC_UNITS.percent, METRIC_BANDS.good, FALLING),
  metric(PROVIDER_METRICS.cancellation, 0.042, METRIC_UNITS.percent, METRIC_BANDS.watch, FLAT),
  metric(PROVIDER_METRICS.rating, 4.8, METRIC_UNITS.rating, METRIC_BANDS.good, RISING),
  metric(PROVIDER_METRICS.onTime, 0.91, METRIC_UNITS.percent, METRIC_BANDS.good, RISING),
];

export const WEAK_METRICS: readonly ProviderMetric[] = [
  metric(PROVIDER_METRICS.completion, 0.82, METRIC_UNITS.percent, METRIC_BANDS.poor, FALLING),
  metric(PROVIDER_METRICS.escalation, 0.11, METRIC_UNITS.percent, METRIC_BANDS.poor, RISING),
  metric(PROVIDER_METRICS.cancellation, 0.094, METRIC_UNITS.percent, METRIC_BANDS.poor, RISING),
  metric(PROVIDER_METRICS.rating, 3.9, METRIC_UNITS.rating, METRIC_BANDS.poor, FALLING),
  metric(PROVIDER_METRICS.onTime, 0.74, METRIC_UNITS.percent, METRIC_BANDS.poor, FALLING),
];

export function documentsWithCertificate(
  skillCertificate: ProviderDocument,
): readonly ProviderDocument[] {
  return [
    { id: "doc-aadhaar", typeKey: "document.aadhaar", state: DOCUMENT_STATES.verified },
    { id: "doc-licence", typeKey: "document.drivingLicence", state: DOCUMENT_STATES.verified },
    skillCertificate,
    { id: "doc-police", typeKey: "document.policeVerification", state: DOCUMENT_STATES.verified },
  ];
}

export const VERIFIED_CERTIFICATE: ProviderDocument = {
  id: "doc-skill",
  typeKey: "document.skillCertificate",
  state: DOCUMENT_STATES.verified,
};

export const EXPIRING_CERTIFICATE: ProviderDocument = {
  id: "doc-skill",
  typeKey: "document.skillCertificate",
  state: DOCUMENT_STATES.expiring,
  expiresAt: "2026-08-13T00:00:00Z",
  daysToExpiry: 22,
};

export const EXPIRED_CERTIFICATE: ProviderDocument = {
  id: "doc-skill",
  typeKey: "document.skillCertificate",
  state: DOCUMENT_STATES.expired,
  expiresAt: "2026-07-18T00:00:00Z",
};

export const RECENT_JOBS: ProviderProfile["recentJobs"] = [
  {
    bookingId: "#B-8801",
    service: "AC Repair",
    at: "2026-07-20T09:10:00Z",
    isCancelled: false,
    rating: 5,
    amountPaise: 1499 * RUPEE,
  },
  {
    bookingId: "#B-8776",
    service: "Refrigerator",
    at: "2026-07-19T11:30:00Z",
    isCancelled: false,
    rating: 5,
    amountPaise: 1200 * RUPEE,
  },
  {
    bookingId: "#B-8752",
    service: "AC Repair",
    at: "2026-07-18T07:45:00Z",
    isCancelled: false,
    rating: 4,
    amountPaise: 1499 * RUPEE,
  },
  {
    bookingId: "#B-8731",
    service: "AC Repair",
    at: "2026-07-17T13:05:00Z",
    isCancelled: true,
    rating: null,
    amountPaise: 0,
  },
  {
    bookingId: "#B-8710",
    service: "Refrigerator",
    at: "2026-07-16T06:20:00Z",
    isCancelled: false,
    rating: 2,
    amountPaise: 2400 * RUPEE,
  },
];

/** Lowest rated first — the ordering the profile screen relies on (spec §6.16). */
export const STRONG_FEEDBACK: ProviderProfile["feedback"] = [
  {
    id: "fb-1",
    rating: 2,
    comment: "Arrived 40 minutes late.",
    author: "Meena R.",
    at: "2026-07-18T15:00:00Z",
  },
  {
    id: "fb-2",
    rating: 2,
    comment: "Did not reassemble the outdoor unit properly.",
    author: "Anita Sharma",
    at: "2026-07-11T10:00:00Z",
  },
];

export const WEAK_FEEDBACK: ProviderProfile["feedback"] = [
  {
    id: "fb-3",
    rating: 2,
    comment: "Left without finishing the job.",
    author: "Ravi K.",
    at: "2026-07-19T12:00:00Z",
  },
  {
    id: "fb-4",
    rating: 2,
    comment: "Cancelled on me at the door.",
    author: "Lakshmi R.",
    at: "2026-07-14T09:00:00Z",
  },
];
