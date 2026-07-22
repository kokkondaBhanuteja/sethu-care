import { ACTIVITY_KINDS, ATTENTION_PRIORITIES } from "./dashboard.types";
import type { ActivityEntry, AlertBandState, DashboardSummary } from "./dashboard.types";

// The metric, band and ticker fixtures the approved artifacts draw (desktop BOX 2, mobile BOX 2/7).
// The queue records live beside them in `attention.fixtures.ts`.

const MINUTE_MS = 60_000;

export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * MINUTE_MS).toISOString();
}

/** Slot times are absolute instants chosen to render as the artifact's IST clock times. */
export const SLOT_3_30_PM = "2026-07-22T10:00:00.000Z";
export const SLOT_3_05_PM = "2026-07-22T09:35:00.000Z";
export const SLOT_3_00_PM = "2026-07-22T09:30:00.000Z";
export const SLOT_4_00_PM = "2026-07-22T10:30:00.000Z";
export const SLOT_4_15_PM = "2026-07-22T10:45:00.000Z";

export const SUMMARY: DashboardSummary = {
  bookings: 142,
  bookingsDelta: { value: 0.12, isGood: true },
  revenuePaise: 21_000_000,
  revenueDelta: { value: 0.08, isGood: true },
  completionRate: 0.942,
  completionDelta: { value: -0.02, isGood: false },
  avgAssignMs: 192_000,
  // Rising assignment time is BAD news, so the up-arrow chip is red. Trend colour is semantic,
  // never directional (spec §6.5, and the artifact says so in a comment on this exact tile). Under
  // Booking-Workflow-Decisions D3 this figure now measures the automation, not the operator.
  avgAssignDelta: { value: 40_000, isGood: false },
  sparklines: {
    bookings: [4, 6, 5, 10, 9, 14, 15, 18],
    revenue: [5, 4, 8, 7, 11, 10, 14, 16],
    completion: [16, 14, 15, 11, 12, 8, 7, 4],
    avgAssign: [5, 7, 6, 10, 9, 13, 14, 17],
  },
  updatedAt: SLOT_3_30_PM,
};

/** "Empty (no bookings today)": tiles show a dash rather than a zero (spec §6.5). */
export const EMPTY_SUMMARY: DashboardSummary = {
  ...SUMMARY,
  bookings: 0,
  bookingsDelta: { value: 0, isGood: true },
  revenuePaise: 0,
  revenueDelta: { value: 0, isGood: true },
  completionRate: 0,
  completionDelta: { value: 0, isGood: true },
  avgAssignMs: 0,
  avgAssignDelta: { value: 0, isGood: true },
  sparklines: { bookings: [], revenue: [], completion: [], avgAssign: [] },
};

export const BAND: AlertBandState = {
  criticalCount: 2,
  examples: [
    { bookingRef: "#B-8823", priority: ATTENTION_PRIORITIES.escalated, surfacedAt: minutesAgo(2) },
  ],
};

export const EMPTY_BAND: AlertBandState = { criticalCount: 0, examples: [] };

export function activityEntries(): readonly ActivityEntry[] {
  return [
    {
      id: "AC-1",
      bookingRef: "#B-8801",
      kind: ACTIVITY_KINDS.completed,
      providerName: null,
      at: minutesAgo(1),
    },
    {
      id: "AC-2",
      bookingRef: "#B-8799",
      kind: ACTIVITY_KINDS.started,
      providerName: null,
      at: minutesAgo(3),
    },
    {
      id: "AC-3",
      bookingRef: "#B-8794",
      kind: ACTIVITY_KINDS.enRoute,
      providerName: null,
      at: minutesAgo(6),
    },
    {
      id: "AC-4",
      bookingRef: "#B-8791",
      kind: ACTIVITY_KINDS.assigned,
      providerName: "Kiran R.",
      at: minutesAgo(8),
    },
    {
      id: "AC-5",
      bookingRef: "#B-8788",
      kind: ACTIVITY_KINDS.completed,
      providerName: null,
      at: minutesAgo(11),
    },
    {
      id: "AC-6",
      bookingRef: "#B-8785",
      kind: ACTIVITY_KINDS.awaitingOtp,
      providerName: null,
      at: minutesAgo(14),
    },
    {
      id: "AC-7",
      bookingRef: "#B-8782",
      kind: ACTIVITY_KINDS.enRoute,
      providerName: null,
      at: minutesAgo(17),
    },
    {
      id: "AC-8",
      bookingRef: "#B-8779",
      kind: ACTIVITY_KINDS.cancelledByCustomer,
      providerName: null,
      at: minutesAgo(21),
    },
  ];
}
