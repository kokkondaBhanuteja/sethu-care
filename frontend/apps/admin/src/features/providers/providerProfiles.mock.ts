// Provider-profile fixtures. Each designed state of BOX 40 / M65 is a distinct provider id so that
// every one is reachable by navigation rather than by editing code — the ids are listed in the
// feature CLAUDE.md.
//
// Any id not listed here resolves to a profile derived from the roster row, so every row in the
// roster opens rather than dead-ending on the not-found state.

import { mockRead } from "../../mocks/mockTransport";
import {
  DOCUMENT_STATES,
  METRIC_BANDS,
  METRIC_UNITS,
  PROVIDER_METRICS,
  PROVIDER_STATUSES,
} from "./providers.types";
import type { ProviderDocument, ProviderMetric, ProviderProfile } from "./providers.types";
import { SUSPEND_REASON_CODES } from "./suspend.types";
import { PROVIDER_IDS, rosterRowById } from "./providerFixtures";

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

const STRONG_METRICS: readonly ProviderMetric[] = [
  metric(PROVIDER_METRICS.completion, 0.96, METRIC_UNITS.percent, METRIC_BANDS.good, RISING),
  metric(PROVIDER_METRICS.escalation, 0.021, METRIC_UNITS.percent, METRIC_BANDS.good, FALLING),
  metric(PROVIDER_METRICS.cancellation, 0.042, METRIC_UNITS.percent, METRIC_BANDS.watch, FLAT),
  metric(PROVIDER_METRICS.rating, 4.8, METRIC_UNITS.rating, METRIC_BANDS.good, RISING),
  metric(PROVIDER_METRICS.onTime, 0.91, METRIC_UNITS.percent, METRIC_BANDS.good, RISING),
];

const WEAK_METRICS: readonly ProviderMetric[] = [
  metric(PROVIDER_METRICS.completion, 0.82, METRIC_UNITS.percent, METRIC_BANDS.poor, FALLING),
  metric(PROVIDER_METRICS.escalation, 0.11, METRIC_UNITS.percent, METRIC_BANDS.poor, RISING),
  metric(PROVIDER_METRICS.cancellation, 0.094, METRIC_UNITS.percent, METRIC_BANDS.poor, RISING),
  metric(PROVIDER_METRICS.rating, 3.9, METRIC_UNITS.rating, METRIC_BANDS.poor, FALLING),
  metric(PROVIDER_METRICS.onTime, 0.74, METRIC_UNITS.percent, METRIC_BANDS.poor, FALLING),
];

function documents(skillCertificate: ProviderDocument): readonly ProviderDocument[] {
  return [
    { id: "doc-aadhaar", typeKey: "document.aadhaar", state: DOCUMENT_STATES.verified },
    { id: "doc-licence", typeKey: "document.drivingLicence", state: DOCUMENT_STATES.verified },
    skillCertificate,
    { id: "doc-police", typeKey: "document.policeVerification", state: DOCUMENT_STATES.verified },
  ];
}

const EXPIRING_CERTIFICATE: ProviderDocument = {
  id: "doc-skill",
  typeKey: "document.skillCertificate",
  state: DOCUMENT_STATES.expiring,
  expiresAt: "2026-08-13T00:00:00Z",
  daysToExpiry: 22,
};

const EXPIRED_CERTIFICATE: ProviderDocument = {
  id: "doc-skill",
  typeKey: "document.skillCertificate",
  state: DOCUMENT_STATES.expired,
  expiresAt: "2026-07-18T00:00:00Z",
};

const SURESH_JOBS: ProviderProfile["recentJobs"] = [
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

const SURESH_FEEDBACK: ProviderProfile["feedback"] = [
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

const SURESH_BASE: ProviderProfile = {
  id: PROVIDER_IDS.healthy,
  name: "Suresh Mehta",
  phone: "+919003144872",
  status: PROVIDER_STATUSES.free,
  isVerified: true,
  rating: 4.8,
  jobsTotal: 412,
  joinedAt: "2025-03-04T00:00:00Z",
  zone: "Kompally",
  zones: ["Kompally", "Madhapur", "Miyapur"],
  jobsToday: 3,
  earningsTodayPaise: 2400 * RUPEE,
  skills: [
    { name: "AC Repair", isPending: false, certifiedTo: "2027-03-31T00:00:00Z" },
    { name: "Refrigerator", isPending: false, certifiedTo: "2027-03-31T00:00:00Z" },
    { name: "Electrical", isPending: true },
  ],
  documents: documents(EXPIRING_CERTIFICATE),
  metrics: STRONG_METRICS,
  recentJobs: SURESH_JOBS,
  feedback: SURESH_FEEDBACK,
  flags: ["2 late arrivals in 30 days", "1 customer complaint (resolved)"],
  payoutCyclePaise: 18_400 * RUPEE,
  version: 7,
};

const PROFILES: readonly ProviderProfile[] = [
  SURESH_BASE,
  { ...SURESH_BASE, id: PROVIDER_IDS.expiredDocuments, documents: documents(EXPIRED_CERTIFICATE) },
  {
    ...SURESH_BASE,
    id: PROVIDER_IDS.suspended,
    status: PROVIDER_STATUSES.suspended,
    jobsToday: 0,
    earningsTodayPaise: 0,
    suspension: {
      until: "2026-07-24T00:00:00Z",
      reasonCode: SUSPEND_REASON_CODES.safetyComplaint,
      byName: "Ravi Kumar",
    },
  },
  {
    ...SURESH_BASE,
    id: PROVIDER_IDS.offboarded,
    status: PROVIDER_STATUSES.offboarded,
    jobsToday: 0,
    earningsTodayPaise: 0,
    offboardedAt: "2026-06-02T00:00:00Z",
  },
  {
    ...SURESH_BASE,
    id: PROVIDER_IDS.poorPerformer,
    name: "Mohan Das",
    phone: "+919003177610",
    status: PROVIDER_STATUSES.onJob,
    rating: 3.9,
    jobsTotal: 268,
    joinedAt: "2025-08-12T00:00:00Z",
    zone: "Miyapur",
    jobsToday: 2,
    earningsTodayPaise: 1750 * RUPEE,
    skills: [
      { name: "Plumbing", isPending: false, certifiedTo: "2027-08-31T00:00:00Z" },
      { name: "Electrical", isPending: false, certifiedTo: "2027-08-31T00:00:00Z" },
      { name: "AC Repair", isPending: true },
    ],
    documents: documents({
      id: "doc-skill",
      typeKey: "document.skillCertificate",
      state: DOCUMENT_STATES.verified,
    }),
    metrics: WEAK_METRICS,
    feedback: [
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
    ],
    flags: ["9 cancellations in 30 days", "3 customer complaints (2 open)"],
    payoutCyclePaise: 9150 * RUPEE,
  },
];

/** A roster row that has no hand-written profile still opens, with the row's own facts. */
function derivedProfile(providerId: string): ProviderProfile | null {
  const row = rosterRowById(providerId);
  if (!row) return null;

  return {
    ...SURESH_BASE,
    id: row.id,
    name: row.name,
    status: row.status,
    rating: row.rating,
    zone: row.zone,
    zones: [row.zone],
    jobsToday: row.jobsToday,
    earningsTodayPaise: row.earningsTodayPaise,
    skills: row.skills.map((name) => ({ name, isPending: false })),
    flags: [],
  };
}

export function fetchProviderProfileMock(
  providerId: string,
  signal?: AbortSignal,
): Promise<ProviderProfile | null> {
  return mockRead<ProviderProfile | null>(
    () => PROFILES.find((profile) => profile.id === providerId) ?? derivedProfile(providerId),
    { ...(signal ? { signal } : {}), emptyValue: null },
  );
}
