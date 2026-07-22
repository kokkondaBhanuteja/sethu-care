// Detail fixtures for the four records the artifacts draw in full:
//   #B-8823 escalated (desktop BOX 6, mobile BOX 8)   #B-8809 healthy (BOX 7 / M9)
//   #B-8788 admin-verified completion (BOX 8 / M10)   #B-8820 changed by someone else (BOX 9 / M11)
// Every other row opens on a record derived from its list entry — see bookings.mock.ts.

import { BOOKING_STATES } from "./bookings.constants";
import { istInstant } from "./bookings.seed";
import type {
  BookingAdminActivity,
  BookingCustomer,
  BookingDetail,
  BookingEvent,
  BookingPayment,
  BookingProvider,
  DispatchRound,
} from "./bookings.types";

const CUSTOMER: BookingCustomer = {
  name: "Ravi Kumar",
  phone: "+919876543210",
  address: "401, Aparna Cyber, Kompally, Hyderabad 500014",
  bookingCount: 14,
  joinedAt: "2025-03-11T00:00:00+05:30",
};

const ESCALATED_ROUNDS: readonly DispatchRound[] = [
  { number: 1, radiusKm: 3, contacted: 5, declined: 5 },
  { number: 2, radiusKm: 4.5, contacted: 8, declined: 8 },
  { number: 3, radiusKm: 6, contacted: 12, declined: 12 },
];

const ACCEPTED_ROUND: DispatchRound = { number: 1, radiusKm: 2.1, contacted: 1, declined: 0 };

function escalatedTimeline(): readonly BookingEvent[] {
  return [
    { id: "created", at: istInstant("15:12"), kind: "created" },
    { id: "searching", at: istInstant("15:12"), kind: "searching" },
    ...ESCALATED_ROUNDS.map((round, index) => ({
      id: `round-${round.number}`,
      at: istInstant(["15:13", "15:16", "15:21"][index] ?? "15:13"),
      kind: "dispatchRound" as const,
      round,
    })),
    { id: "failed", at: istInstant("15:26"), kind: "assignmentFailed" },
    { id: "escalated", at: istInstant("15:26"), kind: "escalated" },
  ];
}

function healthyTimeline(): readonly BookingEvent[] {
  return [
    { id: "created", at: istInstant("14:41"), kind: "created" },
    { id: "searching", at: istInstant("14:41"), kind: "searching" },
    {
      id: "assigned",
      at: istInstant("14:42"),
      kind: "autoAssigned",
      round: ACCEPTED_ROUND,
      providerName: "Suresh M.",
    },
    { id: "en-route", at: istInstant("14:48"), kind: "enRoute" },
    { id: "arrived", at: istInstant("15:01"), kind: "arrived" },
    { id: "started", at: istInstant("15:04"), kind: "started" },
  ];
}

const PREPAID_PAYMENT: BookingPayment = {
  amountPaise: 149900,
  isPrepaid: true,
  methodLabel: "UPI",
  last4: "4242",
  paidAt: istInstant("15:12"),
  transactionId: "TXN8891023",
};

const SURESH: BookingProvider = {
  id: "T-104",
  name: "Suresh Mehta",
  rating: 4.8,
  startedAt: istInstant("15:04"),
  completedAt: null,
};

const ESCALATED_ACTIVITY: readonly BookingAdminActivity[] = [
  { id: "viewed", at: istInstant("15:24"), kind: "viewed", actorName: "Priya S." },
  { id: "escalated", at: istInstant("15:26"), kind: "systemEscalated" },
];

const ESCALATED: BookingDetail = {
  id: "B-8823",
  reference: "#B-8823",
  state: BOOKING_STATES.escalated,
  isAdminVerified: false,
  version: 7,
  serviceTitle: "AC Repair — Deep Clean",
  area: "Kompally",
  amountPaise: 149900,
  createdAt: istInstant("15:12"),
  escalation: { minutesUnresolved: 12, rounds: 3, declined: 8 },
  dispatchRounds: ESCALATED_ROUNDS,
  declinedTotal: 8,
  customer: CUSTOMER,
  provider: null,
  payment: PREPAID_PAYMENT,
  verification: null,
  concurrentChange: null,
  timeline: escalatedTimeline(),
  adminActivity: ESCALATED_ACTIVITY,
  notes: [],
};

const HEALTHY: BookingDetail = {
  ...ESCALATED,
  id: "B-8809",
  reference: "#B-8809",
  state: BOOKING_STATES.inProgress,
  version: 3,
  createdAt: istInstant("14:41"),
  escalation: null,
  dispatchRounds: [ACCEPTED_ROUND],
  declinedTotal: 0,
  provider: SURESH,
  payment: { ...PREPAID_PAYMENT, paidAt: istInstant("14:41"), transactionId: "TXN8890774" },
  timeline: healthyTimeline(),
  adminActivity: [{ id: "auto", at: istInstant("14:42"), kind: "systemAutoAssigned" }],
};

const ADMIN_VERIFIED: BookingDetail = {
  ...HEALTHY,
  id: "B-8788",
  reference: "#B-8788",
  state: BOOKING_STATES.completed,
  isAdminVerified: true,
  version: 5,
  provider: { ...SURESH, completedAt: istInstant("16:12") },
  verification: {
    verifiedByName: "Ravi Kumar",
    verifiedAt: istInstant("16:12"),
    disputeWindowClosesAt: "2026-07-22T16:12:00+05:30",
  },
  timeline: [
    ...healthyTimeline(),
    { id: "otp-failed", at: istInstant("16:08"), kind: "completionOtpFailed" },
    {
      id: "completed",
      at: istInstant("16:12"),
      kind: "completedByAdmin",
      actorName: "Ravi Kumar",
    },
  ],
  adminActivity: [
    { id: "auto", at: istInstant("14:42"), kind: "systemAutoAssigned" },
    {
      id: "verified",
      at: istInstant("16:12"),
      kind: "verifiedCompletion",
      actorName: "Ravi Kumar",
    },
  ],
};

const CHANGED_ELSEWHERE: BookingDetail = {
  ...ESCALATED,
  id: "B-8820",
  reference: "#B-8820",
  version: 9,
  createdAt: istInstant("15:12"),
  concurrentChange: {
    actorName: "Priya S.",
    providerName: "Suresh M.",
    at: istInstant("15:44"),
  },
};

export const BOOKING_DETAIL_FIXTURES: readonly BookingDetail[] = [
  ESCALATED,
  HEALTHY,
  ADMIN_VERIFIED,
  CHANGED_ELSEWHERE,
];
