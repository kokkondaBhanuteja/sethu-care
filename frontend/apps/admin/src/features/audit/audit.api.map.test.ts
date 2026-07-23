import { describe, expect, it } from "vitest";

import type { AuditEntry as ApiAuditEntry } from "@sethu/api-client";

import { auditRangeBounds, mapAuditEntry, toListAuditParams } from "./audit.api.map";
import { AUDIT_ACTIONS, AUDIT_RANGES, AUDIT_TARGET_TYPES } from "./audit.types";
import type { AuditQuery } from "./audit.types";

function query(overrides: Partial<AuditQuery> = {}): AuditQuery {
  return {
    search: "",
    adminId: null,
    action: null,
    targetType: null,
    range: AUDIT_RANGES.last7,
    from: null,
    to: null,
    cursor: null,
    limit: 25,
    ...overrides,
  };
}

// 12:00 UTC = 17:30 IST, so "today" started at 2026-07-23T00:00 IST = 2026-07-22T18:30 UTC.
const NOW = new Date("2026-07-23T12:00:00Z");

describe("auditRangeBounds", () => {
  it("starts Today at IST midnight, expressed in UTC, with an open upper bound", () => {
    expect(auditRangeBounds(query({ range: AUDIT_RANGES.today }), NOW)).toEqual({
      from: "2026-07-22T18:30:00.000Z",
    });
  });

  it("makes Last 7 days today plus the six IST days before it", () => {
    expect(auditRangeBounds(query({ range: AUDIT_RANGES.last7 }), NOW)).toEqual({
      from: "2026-07-16T18:30:00.000Z",
    });
  });

  it("reads a custom range as IST days with an exclusive day-after upper bound", () => {
    const bounds = auditRangeBounds(
      query({ range: AUDIT_RANGES.custom, from: "2026-07-01", to: "2026-07-20" }),
      NOW,
    );

    expect(bounds.from).toBe("2026-06-30T18:30:00.000Z");
    // "to 20 Jul" means "before 21 Jul 00:00 IST".
    expect(bounds.to).toBe("2026-07-20T18:30:00.000Z");
  });
});

describe("toListAuditParams", () => {
  it("omits every null filter and blank search instead of sending empties", () => {
    const params = toListAuditParams(query(), NOW);

    expect(params).toEqual({ from: "2026-07-16T18:30:00.000Z", limit: 25 });
  });

  it("passes the narrowing filters, the target-id search and the cursor through", () => {
    const params = toListAuditParams(
      query({
        search: "  bkg_8823 ",
        adminId: "adm_44",
        action: AUDIT_ACTIONS.bookingCancel,
        targetType: AUDIT_TARGET_TYPES.booking,
        cursor: "b64cursor",
      }),
      NOW,
    );

    expect(params.targetId).toBe("bkg_8823");
    expect(params.adminId).toBe("adm_44");
    expect(params.action).toBe(AUDIT_ACTIONS.bookingCancel);
    expect(params.targetType).toBe(AUDIT_TARGET_TYPES.booking);
    expect(params.cursor).toBe("b64cursor");
  });
});

describe("mapAuditEntry", () => {
  it("copies the §10.4 record field for field, snapshots and links included", () => {
    const apiEntry: ApiAuditEntry = {
      action: AUDIT_ACTIONS.bookingCancel,
      admin: { email: "", id: "adm_1", name: "Demo Admin" },
      after: { State: "Cancelled" },
      before: { State: "Escalated" },
      compensatedByEntryId: null,
      compensatesEntryId: "aud_earlier",
      context: {
        appVersion: "2.1.0",
        approximateLocation: "",
        deviceId: "",
        deviceName: "",
        ipAddress: "",
        otaBundle: "",
        stepUpVerified: false,
        surface: "desktop",
      },
      evidence: { callLogIds: [], photoIds: [], reportIds: [] },
      id: "aud_1",
      immutable: true,
      reason: { code: "CUSTOMER_REQUEST", note: "Customer called in" },
      riskLevel: "high",
      target: { id: "bkg_1", reference: "#B-2EF2E45B", type: AUDIT_TARGET_TYPES.booking },
      timestamp: "2026-07-23T08:00:00Z",
    };

    const entry = mapAuditEntry(apiEntry);

    expect(entry.before).toEqual({ State: "Escalated" });
    expect(entry.after).toEqual({ State: "Cancelled" });
    expect(entry.reason).toEqual({ code: "CUSTOMER_REQUEST", note: "Customer called in" });
    expect(entry.compensatesEntryId).toBe("aud_earlier");
    expect(entry.compensatedByEntryId).toBeNull();
    expect(entry.immutable).toBe(true);
    expect(entry.context.surface).toBe("desktop");
  });
});
