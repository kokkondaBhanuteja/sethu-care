import { afterEach, describe, expect, it } from "vitest";

import {
  BOOKING_WRITE_KINDS,
  recordBookingTransition,
  clearBookingTransition,
  resetBookingTransitions,
  seedTransitionsFromParam,
  readBookingTransition,
} from "../../mocks/bookingStateStore";
import { BOOKING_STATES } from "./bookings.constants";
import { projectDetail, projectListItem } from "./bookings.projection";
import type { BookingDetail, BookingListItem } from "./bookings.types";

// The write-through rule (screen audit finding): a committed mock mutation must be visible in the
// read model — a cancelled booking stops reading as escalated, moves segment, and its record
// carries the cancellation instead of offering "Cancel booking" again.

const AT = "2026-07-20T16:00:00+05:30";

const ESCALATED_ITEM: BookingListItem = {
  id: "B-8823",
  reference: "#B-8823",
  state: BOOKING_STATES.escalated,
  isAdminVerified: false,
  serviceName: "AC Repair",
  customerName: "Ravi Kumar",
  customerPhone: "+919876543210",
  area: "Kompally",
  slotAt: "2026-07-20T15:30:00+05:30",
  amountPaise: 149_900,
  providerName: null,
  providerNote: { kind: "unassignedFor", minutes: 12 },
};

const ESCALATED_DETAIL: BookingDetail = {
  id: "B-8823",
  reference: "#B-8823",
  state: BOOKING_STATES.escalated,
  isAdminVerified: false,
  version: 7,
  serviceTitle: "AC Repair — Deep Clean",
  area: "Kompally",
  amountPaise: 149_900,
  createdAt: "2026-07-20T15:12:00+05:30",
  escalation: { minutesUnresolved: 12, rounds: 3, declined: 8 },
  dispatchRounds: [],
  declinedTotal: 8,
  customer: {
    name: "Ravi Kumar",
    phone: "+919876543210",
    address: "Kompally, Hyderabad",
    bookingCount: 14,
    joinedAt: "2025-03-11T00:00:00+05:30",
  },
  provider: null,
  payment: {
    amountPaise: 149_900,
    isPrepaid: true,
    methodLabel: "UPI",
    last4: "4242",
    paidAt: "2026-07-20T15:12:00+05:30",
    transactionId: "TXN8891023",
  },
  verification: null,
  concurrentChange: null,
  timeline: [{ id: "created", at: "2026-07-20T15:12:00+05:30", kind: "created" }],
  adminActivity: [],
  notes: [],
};

afterEach(() => {
  resetBookingTransitions();
});

describe("bookings projection", () => {
  it("leaves untouched records exactly as fixtured", () => {
    expect(projectListItem(ESCALATED_ITEM)).toBe(ESCALATED_ITEM);
    expect(projectDetail(ESCALATED_DETAIL)).toBe(ESCALATED_DETAIL);
  });

  it("projects a committed cancel onto the list row", () => {
    recordBookingTransition("B-8823", { kind: BOOKING_WRITE_KINDS.cancel, at: AT });

    const projected = projectListItem(ESCALATED_ITEM);
    expect(projected.state).toBe(BOOKING_STATES.cancelled);
    // A cancelled row must not keep advertising "unassigned · 12m".
    expect(projected.providerNote).toEqual({ kind: "none" });
  });

  it("projects a committed cancel onto the record", () => {
    recordBookingTransition("B-8823", { kind: BOOKING_WRITE_KINDS.cancel, at: AT });

    const projected = projectDetail(ESCALATED_DETAIL);
    expect(projected.state).toBe(BOOKING_STATES.cancelled);
    expect(projected.escalation).toBeNull();
    expect(projected.version).toBe(ESCALATED_DETAIL.version + 1);
    expect(projected.timeline.at(-1)).toMatchObject({ kind: "cancelled", at: AT });
  });

  it("undo clears the transition and restores the fixture reading", () => {
    recordBookingTransition("B-8823", { kind: BOOKING_WRITE_KINDS.cancel, at: AT });
    clearBookingTransition("B-8823");

    expect(projectDetail(ESCALATED_DETAIL)).toBe(ESCALATED_DETAIL);
  });

  it("marks a manual completion admin-verified", () => {
    recordBookingTransition("B-8823", { kind: BOOKING_WRITE_KINDS.manualComplete, at: AT });

    const projected = projectDetail(ESCALATED_DETAIL);
    expect(projected.state).toBe(BOOKING_STATES.completed);
    expect(projected.isAdminVerified).toBe(true);
  });

  it("seeds transitions from the dev URL param, ignoring malformed entries", () => {
    seedTransitionsFromParam("B-8823:cancel,garbage,B-8811:notAKind", AT);

    expect(readBookingTransition("B-8823")).toEqual({
      kind: BOOKING_WRITE_KINDS.cancel,
      at: AT,
    });
    expect(readBookingTransition("B-8811")).toBeUndefined();
  });
});
