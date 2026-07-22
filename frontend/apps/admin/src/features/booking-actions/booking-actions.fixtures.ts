// Fixture data for the booking actions, mirroring the approved artifacts so a screen can be
// compared against its design tile directly (booking #B-8823, provider Suresh Mehta, zone Kompally).
//
// Every designed failure state is reachable by booking id — the triggers are listed in this
// feature's CLAUDE.md so a reviewer can walk them without a backend.

import type {
  BookingActionSubject,
  CallAttempt,
  DispatchRound,
  ProviderCandidate,
  RankingWeight,
} from "./booking-actions.types";

/** Booking ids that steer the mock into a specific designed state. */
export const MOCK_BOOKINGS = {
  escalated: "B-8823",
  noCandidates: "B-8811",
  offlineBlocked: "B-8813",
  technicianOnSite: "B-8805",
  evidenceMissing: "B-8809",
  otpArrived: "B-8801",
  tooEarly: "B-8815",
  refundable: "B-8790",
  goodwillCapExceeded: "B-8788",
  refundRateLimited: "B-8787",
} as const;

const CREATED_AT = "2026-07-20T09:42:00.000Z";
const WORK_REPORTED_AT = "2026-07-20T09:32:00.000Z";
const PAID_AT = "2026-07-18T09:42:00.000Z";

const BOOKING_VALUE_PAISE = 149_900;
const PROVIDER_PAYOUT_PAISE = 104_900;

export const FIXTURE_AMOUNTS = {
  bookingValuePaise: BOOKING_VALUE_PAISE,
  providerPayoutPaise: PROVIDER_PAYOUT_PAISE,
  goodwillCapPaise: 50_000,
  incentiveCapPaise: 75_000,
  defaultIncentivePaise: 15_000,
  cancellationFeePaise: 0,
  paidAtIso: PAID_AT,
} as const;

export function subjectFor(bookingId: string): BookingActionSubject {
  return {
    bookingId,
    reference: `#${bookingId}`,
    serviceName: "AC Repair — Deep Clean",
    zone: "Kompally",
    customerName: "Ravi Kumar",
    providerName: bookingId === MOCK_BOOKINGS.escalated ? null : "Suresh Mehta",
    amountPaise: BOOKING_VALUE_PAISE,
    paymentMethodLabel: "UPI ····4242",
    createdAtIso: CREATED_AT,
    escalatedMinutes: 12,
    version: 7,
  };
}

export const DISPATCH_ROUNDS: readonly DispatchRound[] = [
  { round: 1, radiusKm: 3, contacted: 5, declined: 5 },
  { round: 2, radiusKm: 4.5, contacted: 8, declined: 8 },
  { round: 3, radiusKm: 6, contacted: 12, declined: 12 },
];

/** The weights the ranking used, shown rather than hidden — an override needs its own evidence. */
export const RANKING_WEIGHTS: readonly RankingWeight[] = [
  { factorId: "distance", weight: 0.35 },
  { factorId: "skill", weight: 0.25 },
  { factorId: "availability", weight: 0.2 },
  { factorId: "rating", weight: 0.1 },
  { factorId: "load", weight: 0.1 },
];

export const CANDIDATES: readonly ProviderCandidate[] = [
  {
    providerId: "prv_882",
    name: "Suresh Mehta",
    rating: 4.8,
    distanceKm: 2.1,
    etaMinutes: 8,
    skillLabel: "AC certified",
    jobsToday: 3,
    completionRate: 0.96,
    availability: "available",
    freeAtIso: null,
    declinedAtIso: null,
    isBestMatch: true,
  },
  {
    providerId: "prv_741",
    name: "Kiran Rao",
    rating: 4.6,
    distanceKm: 3.4,
    etaMinutes: 12,
    skillLabel: "AC certified",
    jobsToday: 5,
    completionRate: 0.91,
    availability: "available",
    freeAtIso: null,
    declinedAtIso: null,
    isBestMatch: false,
  },
  {
    providerId: "prv_615",
    name: "Ajay Verma",
    rating: 4.9,
    distanceKm: 1.8,
    etaMinutes: 6,
    skillLabel: "AC certified",
    jobsToday: 2,
    completionRate: 0.98,
    availability: "onJob",
    freeAtIso: "2026-07-20T10:40:00.000Z",
    declinedAtIso: null,
    isBestMatch: false,
  },
  {
    providerId: "prv_509",
    name: "Mohan Das",
    rating: 4.3,
    distanceKm: 5.2,
    etaMinutes: 18,
    skillLabel: null,
    jobsToday: 1,
    completionRate: 0.88,
    availability: "declined",
    freeAtIso: null,
    declinedAtIso: "2026-07-20T09:46:00.000Z",
    isBestMatch: false,
  },
];

/** Machine-written, never typed by the admin — evidence an admin can author is not evidence. */
export const CALL_ATTEMPTS: readonly CallAttempt[] = [
  { id: "call_1", atIso: "2026-07-20T09:38:00.000Z", outcome: "no answer", durationSeconds: 45 },
  { id: "call_2", atIso: "2026-07-20T09:54:00.000Z", outcome: "no answer", durationSeconds: 30 },
];

export const WORK_PHOTO_IDS: readonly string[] = ["photo_1", "photo_2", "photo_3"];

export const COMPLETION_REPORT = {
  id: "report_1",
  submittedAtIso: WORK_REPORTED_AT,
  workReportedAtIso: WORK_REPORTED_AT,
} as const;

export const OTP_ARRIVED_AT_ISO = "2026-07-20T10:17:00.000Z";
export const RATE_LIMIT_RESETS_AT_ISO = "2026-07-20T11:42:00.000Z";
