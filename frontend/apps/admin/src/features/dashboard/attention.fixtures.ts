import { ATTENTION_PRIORITIES } from "./dashboard.types";
import type { AttentionItem, AttentionQueue } from "./dashboard.types";
import {
  minutesAgo,
  SLOT_3_00_PM,
  SLOT_3_05_PM,
  SLOT_3_30_PM,
  SLOT_4_00_PM,
  SLOT_4_15_PM,
} from "./dashboard.fixtures";

// The five queue records the approved artifacts draw (desktop BOX 2/18, mobile BOX 2/30), row for
// row, so a screen can be held against its design tile directly. Ages are anchored to "now" rather
// than hardcoded strings, because the age column is derived through lib/format like every other
// value on the screen.

export function attentionItems(): readonly AttentionItem[] {
  return [
    {
      alertId: "AL-3301",
      bookingId: "B-8823",
      bookingRef: "#B-8823",
      priority: ATTENTION_PRIORITIES.escalated,
      service: "AC Repair",
      customerName: "Ravi Kumar",
      area: "Kompally",
      reason: "No provider found after 3 rounds",
      providerName: null,
      providerState: "unassigned",
      surfacedAt: minutesAgo(12),
      slotAt: SLOT_3_30_PM,
      amountPaise: 149_900,
      acknowledged: false,
    },
    {
      alertId: "AL-3302",
      bookingId: "B-8811",
      bookingRef: "#B-8811",
      priority: ATTENTION_PRIORITIES.escalated,
      service: "Plumbing",
      customerName: "Vikram S.",
      area: "Miyapur",
      reason: "Provider unreachable for 22 min",
      providerName: "Mohan D.",
      providerState: "unreachable",
      surfacedAt: minutesAgo(34),
      slotAt: SLOT_3_05_PM,
      amountPaise: 89_900,
      acknowledged: false,
    },
    {
      alertId: "AL-3303",
      bookingId: "B-8805",
      bookingRef: "#B-8805",
      priority: ATTENTION_PRIORITIES.slaBreached,
      service: "Refrigerator",
      customerName: "Arun Teja",
      area: "Madhapur",
      reason: "Start OTP not shared for 25 min",
      providerName: "Ajay V.",
      providerState: null,
      surfacedAt: minutesAgo(18),
      slotAt: SLOT_3_00_PM,
      amountPaise: 74_900,
      acknowledged: false,
    },
    {
      alertId: "AL-3304",
      bookingId: "B-8817",
      bookingRef: "#B-8817",
      priority: ATTENTION_PRIORITIES.slaRisk,
      service: "Plumbing",
      customerName: "Anita Sharma",
      area: "Gachibowli",
      reason: "Suresh M. running 11 min late",
      providerName: "Suresh M.",
      providerState: null,
      surfacedAt: minutesAgo(6),
      slotAt: SLOT_4_00_PM,
      amountPaise: 89_900,
      acknowledged: false,
    },
    {
      alertId: "AL-3305",
      bookingId: "B-8830",
      bookingRef: "#B-8830",
      priority: ATTENTION_PRIORITIES.noResponse,
      service: "AC Repair",
      customerName: "Deepa N.",
      area: "Kompally",
      reason: "Customer did not answer 2 calls",
      providerName: null,
      providerState: null,
      surfacedAt: minutesAgo(5),
      slotAt: SLOT_4_15_PM,
      amountPaise: 149_900,
      acknowledged: false,
    },
  ];
}

/** The design's all-clear state: seven were open, none is now, 42 jobs are running. */
export const EMPTY_QUEUE: AttentionQueue = {
  items: [],
  total: 0,
  counts: { all: 0, escalated: 0, unassigned: 0, sla: 0, delayed: 0, no_response: 0 },
  lastCleared: { at: SLOT_3_30_PM, bookingRef: "#B-8811", adminName: "Priya S." },
  healthyJobs: 42,
  updatedAt: SLOT_3_30_PM,
};
