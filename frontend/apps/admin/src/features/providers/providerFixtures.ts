// The roster rows the artifact draws (BOX 20 / M34), plus the ids that select each designed
// profile state. Shared by the roster mock and the profile mock, which is why they live here
// rather than in either one.

import { PROVIDER_STATUSES } from "./providers.types";
import type { ProviderRosterRow } from "./providers.types";

/** Trigger ids for the designed profile states — documented in the feature CLAUDE.md. */
export const PROVIDER_IDS = {
  healthy: "PRV-882",
  expiredDocuments: "PRV-884",
  suspended: "PRV-885",
  offboarded: "PRV-886",
  poorPerformer: "PRV-907",
} as const;

const RUPEE = 100;
const MINUTE_MS = 60_000;

export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * MINUTE_MS).toISOString();
}

export const ROSTER_ROWS: readonly ProviderRosterRow[] = [
  {
    id: PROVIDER_IDS.healthy,
    name: "Suresh Mehta",
    status: PROVIDER_STATUSES.free,
    skills: ["AC", "Refrigerator"],
    zone: "Kompally",
    jobsToday: 3,
    earningsTodayPaise: 2400 * RUPEE,
    rating: 4.8,
    completionRate: 0.96,
    lastSeenAt: null,
  },
  {
    id: "PRV-901",
    name: "Kiran Rao",
    status: PROVIDER_STATUSES.onJob,
    skills: ["Plumbing"],
    zone: "Gachibowli",
    jobsToday: 4,
    earningsTodayPaise: 3100 * RUPEE,
    rating: 4.6,
    completionRate: 0.94,
    lastSeenAt: null,
    currentJob: { bookingId: "#B-8817", stageLabel: "En route · ETA 8m" },
  },
  {
    id: "PRV-903",
    name: "Ajay Verma",
    status: PROVIDER_STATUSES.offline,
    skills: ["Electrical"],
    zone: "Miyapur",
    jobsToday: 0,
    earningsTodayPaise: 0,
    rating: 4.9,
    completionRate: 0.88,
    lastSeenAt: minutesAgo(120),
  },
  {
    id: PROVIDER_IDS.poorPerformer,
    name: "Mohan Das",
    status: PROVIDER_STATUSES.suspended,
    skills: ["AC"],
    zone: "Kompally",
    jobsToday: 0,
    earningsTodayPaise: 0,
    rating: 3.9,
    completionRate: 0.82,
    lastSeenAt: minutesAgo(3 * 24 * 60),
    suspendedUntil: "2026-07-24T00:00:00Z",
  },
  {
    id: "PRV-911",
    name: "Priya Nair",
    status: PROVIDER_STATUSES.free,
    skills: ["Plumbing", "Electrical"],
    zone: "Madhapur",
    jobsToday: 2,
    earningsTodayPaise: 1750 * RUPEE,
    rating: 4.7,
    completionRate: 0.95,
    lastSeenAt: null,
  },
  {
    id: "PRV-914",
    name: "Rakesh Gupta",
    status: PROVIDER_STATUSES.onJob,
    skills: ["AC"],
    zone: "Gachibowli",
    jobsToday: 5,
    earningsTodayPaise: 3600 * RUPEE,
    rating: 4.5,
    completionRate: 0.91,
    lastSeenAt: null,
    currentJob: { bookingId: "#B-8824", stageLabel: "In progress" },
  },
  {
    id: "PRV-918",
    name: "Sunil Yadav",
    status: PROVIDER_STATUSES.free,
    skills: ["Refrigerator"],
    zone: "Miyapur",
    jobsToday: 1,
    earningsTodayPaise: 850 * RUPEE,
    rating: 4.4,
    completionRate: 0.93,
    lastSeenAt: minutesAgo(4),
  },
  {
    id: "PRV-921",
    name: "Farhan Ali",
    status: PROVIDER_STATUSES.onJob,
    skills: ["Electrical"],
    zone: "Kompally",
    jobsToday: 3,
    earningsTodayPaise: 2150 * RUPEE,
    rating: 4.8,
    completionRate: 0.97,
    lastSeenAt: null,
    currentJob: { bookingId: "#B-8829", stageLabel: "En route · ETA 14m" },
  },
  {
    id: "PRV-925",
    name: "Divya Menon",
    status: PROVIDER_STATUSES.free,
    skills: ["AC", "Plumbing"],
    zone: "Madhapur",
    jobsToday: 2,
    earningsTodayPaise: 1900 * RUPEE,
    rating: 4.6,
    completionRate: 0.92,
    lastSeenAt: minutesAgo(1),
  },
  {
    id: "PRV-930",
    name: "Naresh Babu",
    status: PROVIDER_STATUSES.offline,
    skills: ["Plumbing"],
    zone: "Gachibowli",
    jobsToday: 0,
    earningsTodayPaise: 0,
    rating: 4.2,
    completionRate: 0.86,
    lastSeenAt: minutesAgo(5 * 60),
  },
];

export function rosterRowById(providerId: string): ProviderRosterRow | undefined {
  return ROSTER_ROWS.find((row) => row.id === providerId);
}
