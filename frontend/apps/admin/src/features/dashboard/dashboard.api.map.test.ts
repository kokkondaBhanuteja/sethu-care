import { describe, expect, it } from "vitest";

import type {
  AttentionItem as ApiAttentionItem,
  AttentionQueue as ApiAttentionQueue,
} from "@sethu/api-client";

import {
  attentionReason,
  mapAttentionQueue,
  mapDashboardSummary,
  toServerAttentionFilter,
} from "./dashboard.api.map";
import { ATTENTION_FILTERS, ATTENTION_PRIORITIES } from "./dashboard.types";

// The real /ops payloads carry the diagnosis as numbers and a five-value filter vocabulary; these
// mappers own the translation onto dashboard.types.ts, which is the normative shape.

function apiItem(overrides: Partial<ApiAttentionItem> = {}): ApiAttentionItem {
  return {
    acknowledged: false,
    alertId: "bkg_1",
    amountPaise: 59900,
    area: "Bengaluru",
    bookingId: "bkg_1",
    bookingRef: "#B-2EF2E45B",
    customerName: "Asha",
    diagnosis: { declinedCount: null, dispatchRounds: null, minutesOverdue: null },
    priority: ATTENTION_PRIORITIES.failedAssignment,
    providerName: null,
    providerState: "unassigned",
    service: "AC Repair",
    slotAt: "2026-07-22T10:00:00+05:30",
    surfacedAt: "2026-07-22T09:00:00+05:30",
    ...overrides,
  };
}

function apiQueue(items: readonly ApiAttentionItem[]): ApiAttentionQueue {
  return {
    counts: { all: items.length, delayed: 0, escalated: 0, sla: 0, unassigned: 1 },
    healthyJobs: 2,
    items: [...items],
    lastCleared: null,
    nextCursor: null,
    total: items.length,
    updatedAt: "2026-07-23T08:00:00Z",
  };
}

describe("toServerAttentionFilter", () => {
  it("passes the server's own vocabulary through", () => {
    expect(toServerAttentionFilter(ATTENTION_FILTERS.escalated)).toBe(ATTENTION_FILTERS.escalated);
  });

  it("asks for the whole queue when the chip is no_response — the server has no such filter", () => {
    expect(toServerAttentionFilter(ATTENTION_FILTERS.noResponse)).toBe(ATTENTION_FILTERS.all);
  });
});

describe("attentionReason", () => {
  it("words a failed assignment from its rounds and declines", () => {
    const reason = attentionReason(
      apiItem({ diagnosis: { declinedCount: 4, dispatchRounds: 3, minutesOverdue: null } }),
    );
    expect(reason).toBe("No provider found after 3 rounds, 4 declined");
  });

  it("words a SEARCHING booking (zero rounds) without inventing attempts", () => {
    const reason = attentionReason(
      apiItem({ diagnosis: { declinedCount: 0, dispatchRounds: 0, minutesOverdue: null } }),
    );
    expect(reason).toBe("No provider found yet");
  });

  it("words an SLA breach from its overdue minutes", () => {
    const reason = attentionReason(
      apiItem({
        priority: ATTENTION_PRIORITIES.slaBreached,
        diagnosis: { declinedCount: null, dispatchRounds: null, minutesOverdue: 25 },
      }),
    );
    expect(reason).toBe("25 min past the promised slot");
  });

  it("words an SLA risk as running late", () => {
    const reason = attentionReason(
      apiItem({
        priority: ATTENTION_PRIORITIES.slaRisk,
        diagnosis: { declinedCount: null, dispatchRounds: null, minutesOverdue: 11 },
      }),
    );
    expect(reason).toBe("Running 11 min late");
  });
});

describe("mapAttentionQueue", () => {
  it("copies the queue onto the feature shape and counts no_response from the rows", () => {
    const noResponseItem = apiItem({
      alertId: "bkg_2",
      priority: ATTENTION_PRIORITIES.noResponse,
    });
    const queue = mapAttentionQueue(apiQueue([apiItem(), noResponseItem]), ATTENTION_FILTERS.all);

    expect(queue.items).toHaveLength(2);
    expect(queue.counts.no_response).toBe(1);
    expect(queue.counts.all).toBe(2);
    expect(queue.lastCleared).toBeNull();
    expect(queue.healthyJobs).toBe(2);
  });

  it("narrows to no-response rows client-side when that chip asked", () => {
    const noResponseItem = apiItem({
      alertId: "bkg_2",
      priority: ATTENTION_PRIORITIES.noResponse,
    });
    const queue = mapAttentionQueue(
      apiQueue([apiItem(), noResponseItem]),
      ATTENTION_FILTERS.noResponse,
    );

    expect(queue.items.map((item) => item.alertId)).toEqual(["bkg_2"]);
  });

  it("keeps the empty queue's lastCleared citation for the all-clear state", () => {
    const payload: ApiAttentionQueue = {
      ...apiQueue([]),
      lastCleared: {
        adminName: "Demo Admin",
        at: "2026-07-18T16:01:30+05:30",
        bookingRef: "#B-2EF2E45B",
      },
    };
    const queue = mapAttentionQueue(payload, ATTENTION_FILTERS.all);

    expect(queue.lastCleared?.adminName).toBe("Demo Admin");
    expect(queue.lastCleared?.bookingRef).toBe("#B-2EF2E45B");
  });
});

describe("mapDashboardSummary", () => {
  it("copies every KPI, delta and sparkline field for field", () => {
    const summary = mapDashboardSummary({
      avgAssignDelta: { isGood: false, value: 40_000 },
      avgAssignMs: 132_000,
      bookings: 12,
      bookingsDelta: { isGood: true, value: 3 },
      completionDelta: { isGood: true, value: 0.02 },
      completionRate: 0.94,
      revenueDelta: { isGood: true, value: 120_000 },
      revenuePaise: 1_920_000,
      sparklines: {
        avgAssign: [1, 2, 3, 4, 5, 6, 7, 8],
        bookings: [1, 2, 3, 4, 5, 6, 7, 8],
        completion: [1, 2, 3, 4, 5, 6, 7, 8],
        revenue: [1, 2, 3, 4, 5, 6, 7, 8],
      },
      updatedAt: "2026-07-23T08:00:00Z",
    });

    expect(summary.bookings).toBe(12);
    expect(summary.avgAssignDelta).toEqual({ value: 40_000, isGood: false });
    expect(summary.completionDelta.value).toBeCloseTo(0.02);
    expect(summary.sparklines.revenue).toHaveLength(8);
    expect(summary.updatedAt).toBe("2026-07-23T08:00:00Z");
  });
});
