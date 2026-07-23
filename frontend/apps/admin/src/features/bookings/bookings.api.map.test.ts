import { describe, expect, it } from "vitest";

import type { BookingListItem as ApiBookingListItem } from "@sethu/api-client";

import {
  BOOKINGS_FETCH_CAP,
  deriveBookingsSummary,
  mapBookingEvent,
  mapBookingListItem,
  mapProviderNote,
  toListBookingsParams,
} from "./bookings.api.map";
import { BOOKING_SEGMENTS, BOOKING_STATES } from "./bookings.constants";

function apiListItem(overrides: Partial<ApiBookingListItem> = {}): ApiBookingListItem {
  return {
    amountPaise: 59900,
    area: "Bengaluru",
    customerName: "Asha",
    customerPhone: "+919000000000",
    id: "2ef2e45b-030d-4ce9-9b1e-463bd2087147",
    isAdminVerified: false,
    providerName: "Demo Technician",
    providerNote: { kind: "none" },
    reference: "#B-2EF2E45B",
    serviceName: "AC Repair & Service",
    slotAt: "2026-07-16T12:22:19+05:30",
    state: BOOKING_STATES.assigned,
    ...overrides,
  };
}

describe("toListBookingsParams", () => {
  it("omits the state and q params entirely when nothing narrows the segment", () => {
    const params = toListBookingsParams({
      segment: BOOKING_SEGMENTS.active,
      search: "",
      states: [],
      limit: 10,
    });

    expect(params).toEqual({ segment: BOOKING_SEGMENTS.active, limit: 10 });
  });

  it("passes states and the search term through, and caps limit at the server's 100", () => {
    const params = toListBookingsParams({
      segment: BOOKING_SEGMENTS.active,
      search: "#B-2EF2",
      states: [BOOKING_STATES.escalated],
      limit: 250,
    });

    expect(params.state).toEqual([BOOKING_STATES.escalated]);
    expect(params.q).toBe("#B-2EF2");
    expect(params.limit).toBe(BOOKINGS_FETCH_CAP);
  });
});

describe("mapProviderNote", () => {
  it("maps every discriminant onto the feature vocabulary", () => {
    expect(mapProviderNote({ kind: "none" })).toEqual({ kind: "none" });
    expect(mapProviderNote({ kind: "unassignedFor", minutes: 18 })).toEqual({
      kind: "unassignedFor",
      minutes: 18,
    });
    expect(mapProviderNote({ kind: "startedAt", at: "2026-07-23T08:00:00Z" })).toEqual({
      kind: "startedAt",
      at: "2026-07-23T08:00:00Z",
    });
    expect(mapProviderNote({ kind: "rating", rating: 4.8 })).toEqual({
      kind: "rating",
      rating: 4.8,
    });
  });
});

describe("mapBookingEvent", () => {
  it("renames the server's 1-based `round` field to the feature's `number`", () => {
    const event = mapBookingEvent({
      at: "2026-07-23T08:00:00Z",
      id: "evt_1",
      kind: "dispatchRound",
      round: { contacted: 5, declined: 2, radiusKm: 3, round: 2 },
    });

    expect(event.round).toEqual({ number: 2, radiusKm: 3, contacted: 5, declined: 2 });
  });

  it("keeps the actor of a manual assign, which arrives as autoAssigned with actorName set", () => {
    const event = mapBookingEvent({
      actorName: "Demo Admin",
      at: "2026-07-23T08:00:00Z",
      id: "evt_2",
      kind: "autoAssigned",
      providerName: "Demo Technician",
    });

    expect(event.actorName).toBe("Demo Admin");
    expect(event.providerName).toBe("Demo Technician");
  });
});

describe("deriveBookingsSummary", () => {
  // The stat strip is derived client-side because GET /ops/bookings carries no summary field yet
  // (contract gap, flagged) — these figures see the fetched rows, nothing more.

  it("counts escalated rows and finds the oldest unassigned age", () => {
    const summary = deriveBookingsSummary([
      mapBookingListItem(apiListItem({ state: BOOKING_STATES.escalated })),
      mapBookingListItem(
        apiListItem({ providerName: null, providerNote: { kind: "unassignedFor", minutes: 12 } }),
      ),
      mapBookingListItem(
        apiListItem({ providerName: null, providerNote: { kind: "unassignedFor", minutes: 31 } }),
      ),
    ]);

    expect(summary.escalated).toBe(1);
    expect(summary.oldestUnassignedMinutes).toBe(31);
  });

  it("reports null for the unassigned age when every row has a provider", () => {
    const summary = deriveBookingsSummary([mapBookingListItem(apiListItem())]);

    expect(summary.oldestUnassignedMinutes).toBeNull();
    expect(summary.escalated).toBe(0);
  });

  it("counts a completion as today's only on the same IST calendar day", () => {
    const now = new Date("2026-07-23T02:00:00Z"); // 07:30 IST, 23 Jul
    const completedTodayIst = apiListItem({
      state: BOOKING_STATES.completed,
      // 22 Jul 20:30 UTC is already 02:00 IST on 23 Jul — the IST day is what counts.
      slotAt: "2026-07-22T20:30:00Z",
    });
    const completedYesterday = apiListItem({
      state: BOOKING_STATES.completed,
      slotAt: "2026-07-22T10:00:00Z",
    });

    const summary = deriveBookingsSummary(
      [mapBookingListItem(completedTodayIst), mapBookingListItem(completedYesterday)],
      now,
    );

    expect(summary.completedToday).toBe(1);
  });
});
