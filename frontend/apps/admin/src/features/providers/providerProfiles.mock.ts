// Provider-profile fixtures. Each designed state of BOX 40 / M65 is a distinct provider id so that
// every one is reachable by navigation rather than by editing code — the ids are listed in the
// feature CLAUDE.md.
//
// Any id not listed here resolves to a profile derived from the roster row, so every row in the
// roster opens rather than dead-ending on the not-found state.

import { mockRead } from "../../mocks/mockTransport";
import { PROVIDER_STATUSES } from "./providers.types";
import type { ProviderProfile } from "./providers.types";
import { SUSPEND_REASON_CODES } from "./suspend.types";
import { PROVIDER_IDS, rosterRowById } from "./providerFixtures";
import {
  documentsWithCertificate,
  EXPIRED_CERTIFICATE,
  EXPIRING_CERTIFICATE,
  RECENT_JOBS,
  STRONG_FEEDBACK,
  STRONG_METRICS,
  VERIFIED_CERTIFICATE,
  WEAK_FEEDBACK,
  WEAK_METRICS,
} from "./providerProfileData";

const RUPEE = 100;

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
  documents: documentsWithCertificate(EXPIRING_CERTIFICATE),
  metrics: STRONG_METRICS,
  recentJobs: RECENT_JOBS,
  feedback: STRONG_FEEDBACK,
  flags: ["2 late arrivals in 30 days", "1 customer complaint (resolved)"],
  payoutCyclePaise: 18_400 * RUPEE,
  version: 7,
};

const MOHAN_POOR_PERFORMER: ProviderProfile = {
  ...SURESH_BASE,
  id: PROVIDER_IDS.poorPerformer,
  name: "Mohan Das",
  phone: "+919003177610",
  status: PROVIDER_STATUSES.onJob,
  rating: 3.9,
  jobsTotal: 268,
  joinedAt: "2025-08-12T00:00:00Z",
  zone: "Miyapur",
  zones: ["Miyapur", "Kompally"],
  jobsToday: 2,
  earningsTodayPaise: 1750 * RUPEE,
  skills: [
    { name: "Plumbing", isPending: false, certifiedTo: "2027-08-31T00:00:00Z" },
    { name: "Electrical", isPending: false, certifiedTo: "2027-08-31T00:00:00Z" },
    { name: "AC Repair", isPending: true },
  ],
  documents: documentsWithCertificate(VERIFIED_CERTIFICATE),
  metrics: WEAK_METRICS,
  feedback: WEAK_FEEDBACK,
  flags: ["9 cancellations in 30 days", "3 customer complaints (2 open)"],
  payoutCyclePaise: 9150 * RUPEE,
};

const PROFILES: readonly ProviderProfile[] = [
  SURESH_BASE,
  {
    ...SURESH_BASE,
    id: PROVIDER_IDS.expiredDocuments,
    documents: documentsWithCertificate(EXPIRED_CERTIFICATE),
  },
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
  MOHAN_POOR_PERFORMER,
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
