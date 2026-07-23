import { describe, expect, it } from "vitest";

import type {
  LiveMapSnapshot as ApiLiveMapSnapshot,
  MapAttentionItem as ApiMapAttentionItem,
  MapJob as ApiMapJob,
  MapProvider as ApiMapProvider,
} from "@sethu/api-client";

import {
  bareBookingRef,
  mapLiveMapSnapshot,
  mapMapAttentionItem,
  mapMapJob,
  mapMapProvider,
} from "./map.api.map";

// The real /ops/live-map ships positions as percentages of an UNDECLARED bounding box
// (backend internal/ops/livemap.go), so the mapper's one load-bearing rule is: never invent a
// coordinate. Everything else — statuses, refs, counts, the attention rail — copies faithfully.

const BOOKING_ID = "0198c5a7-1111-2222-3333-444455556666";
const TECHNICIAN_ID = "0198c5a7-aaaa-bbbb-cccc-ddddeeeeffff";

const apiProvider: ApiMapProvider = {
  id: TECHNICIAN_ID,
  name: "Ravi Kumar",
  status: "busy",
  zoneId: "",
  position: { xPercent: 10, yPercent: 90 },
  locatedAt: "2026-07-23T08:59:50Z",
  onBookingRef: "#B-0198C5A7",
};

const apiJob: ApiMapJob = {
  id: BOOKING_ID,
  bookingRef: "#B-0198C5A7",
  state: "enRoute",
  zoneId: "",
  position: { xPercent: 50, yPercent: 50 },
  serviceName: "AC Repair",
};

const apiAttention: ApiMapAttentionItem = {
  id: BOOKING_ID,
  bookingRef: "#B-0198C5A7",
  reason: "escalated",
  zoneId: "",
  waitingSince: "2026-07-23T08:48:00Z",
};

const apiSnapshot: ApiLiveMapSnapshot = {
  observedAt: "2026-07-23T09:00:00Z",
  activeJobCount: 7,
  onlineProviderCount: 2,
  zones: [],
  clusters: [],
  providers: [apiProvider],
  jobs: [apiJob],
  attention: [apiAttention],
  zeroSupplyZoneIds: [],
};

describe("bareBookingRef", () => {
  it("strips the server's display '#' so the views' own '#' does not double", () => {
    expect(bareBookingRef("#B-0198C5A7")).toBe("B-0198C5A7");
    expect(bareBookingRef("B-8823")).toBe("B-8823");
  });
});

describe("mapMapProvider", () => {
  it("copies identity and status faithfully and never invents a position", () => {
    expect(mapMapProvider(apiProvider)).toEqual({
      id: TECHNICIAN_ID,
      name: "Ravi Kumar",
      status: "busy",
      zoneId: "",
      position: null,
      locatedAt: "2026-07-23T08:59:50Z",
      onBookingRef: "B-0198C5A7",
    });
  });

  it("omits onBookingRef entirely when the technician is not on a job", () => {
    const { onBookingRef: ignoredRef, ...freeProvider } = apiProvider;
    void ignoredRef;
    const mapped = mapMapProvider({ ...freeProvider, status: "online" });
    expect("onBookingRef" in mapped).toBe(false);
    expect(mapped.status).toBe("online");
  });
});

describe("mapMapJob", () => {
  it("keeps the state vocabulary and drops the uninvertible position", () => {
    expect(mapMapJob(apiJob)).toEqual({
      id: BOOKING_ID,
      bookingRef: "B-0198C5A7",
      state: "enRoute",
      zoneId: "",
      position: null,
      serviceName: "AC Repair",
    });
  });
});

describe("mapMapAttentionItem", () => {
  it("navigates by the raw booking id (the server's attention id) and displays the bare ref", () => {
    expect(mapMapAttentionItem(apiAttention)).toEqual({
      id: BOOKING_ID,
      bookingId: BOOKING_ID,
      bookingRef: "B-0198C5A7",
      reason: "escalated",
      zoneId: "",
      waitingSince: "2026-07-23T08:48:00Z",
    });
  });
});

describe("mapLiveMapSnapshot", () => {
  const snapshot = mapLiveMapSnapshot(apiSnapshot);

  it("carries the city totals and the staleness input verbatim", () => {
    expect(snapshot.observedAt).toBe("2026-07-23T09:00:00Z");
    expect(snapshot.activeJobCount).toBe(7);
    expect(snapshot.onlineProviderCount).toBe(2);
  });

  it("maps every marker family and keeps zones/clusters honestly empty", () => {
    expect(snapshot.providers).toHaveLength(1);
    expect(snapshot.jobs).toHaveLength(1);
    expect(snapshot.attention).toHaveLength(1);
    expect(snapshot.zones).toEqual([]);
    expect(snapshot.clusters).toEqual([]);
    expect(snapshot.zeroSupplyZoneIds).toEqual([]);
  });

  it("gives no real marker a canvas position — the coordinate gap is dropped, never faked", () => {
    for (const provider of snapshot.providers) expect(provider.position).toBeNull();
    for (const job of snapshot.jobs) expect(job.position).toBeNull();
  });
});
