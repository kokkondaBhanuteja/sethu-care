import { describe, expect, it } from "vitest";

import type { Alert as ApiAlert, AlertDetail as ApiAlertDetail } from "@sethu/api-client";

import {
  composeAlertSummary,
  mapAcknowledgeResult,
  mapAlert,
  mapAlertDetail,
  mapHistoryEntry,
  mapRelatedRecord,
  mapTrigger,
} from "./alerts.api.map";

// Fixtures mirror the LIVE /ops/alerts payloads (seeded bookingEscalated alert) — the mappers own
// the translation onto alerts.types.ts, which is the normative shape.

function apiAlert(overrides: Partial<ApiAlert> = {}): ApiAlert {
  return {
    id: "a7000000-0000-4000-8000-000000000001",
    type: "bookingEscalated",
    severity: "critical",
    titleParams: { reference: "#B-A4000000" },
    summaryParams: { reference: "#B-A4000000", service: "AC Repair & Service", zone: "Bengaluru" },
    createdAt: "2026-07-23T09:46:33.475+05:30",
    requiresAcknowledgement: true,
    acknowledgement: null,
    subject: {
      id: "a4000000-0000-4000-8000-000000000001",
      kind: "booking",
      reference: "#B-A4000000",
    },
    ...overrides,
  };
}

function apiDetail(overrides: Partial<ApiAlertDetail> = {}): ApiAlertDetail {
  return {
    ...apiAlert(),
    description: "Dispatch handed this booking to a human operator.",
    trigger: {
      rule: "booking.escalated",
      threshold: "state = ESCALATED",
      actual: "SEARCHING → ESCALATED",
    },
    canMute: false,
    relatedRecord: {
      amountPaise: 59900,
      bookingState: "ESCALATED",
      createdAt: "2026-07-23T09:46:33.475+05:30",
      id: "a4000000-0000-4000-8000-000000000001",
      kind: "booking",
      providerStatus: null,
      reference: "#B-A4000000",
      subtitle: "Deepa Demo",
      title: "AC Repair & Service",
    },
    relatedAlerts: [],
    history: [
      {
        id: "h1",
        at: "2026-07-23T09:46:33.475+05:30",
        body: "ESCALATE: SEARCHING → ESCALATED",
        tone: "danger",
      },
    ],
    notes: [],
    ...overrides,
  };
}

describe("composeAlertSummary", () => {
  it("joins the nouns the server sent with the feed's separator", () => {
    expect(
      composeAlertSummary({
        reference: "#B-A4000000",
        service: "AC Repair & Service",
        zone: "Bengaluru",
      }),
    ).toBe("#B-A4000000 · AC Repair & Service · Bengaluru");
  });

  it("drops an empty zone without leaving a dangling separator — zones do not exist yet", () => {
    expect(composeAlertSummary({ reference: "#B-1", service: "AC Repair", zone: "" })).toBe(
      "#B-1 · AC Repair",
    );
  });

  it("is empty when the server sent nothing", () => {
    expect(composeAlertSummary({})).toBe("");
  });
});

describe("mapAlert", () => {
  it("copies every feed-row field and composes the summary", () => {
    const mapped = mapAlert(apiAlert());
    expect(mapped.id).toBe("a7000000-0000-4000-8000-000000000001");
    expect(mapped.summary).toBe("#B-A4000000 · AC Repair & Service · Bengaluru");
    expect(mapped.acknowledgement).toBeNull();
    expect(mapped.subject?.reference).toBe("#B-A4000000");
  });

  it("keeps only string interpolation values — the generated index signature admits unknown", () => {
    const mapped = mapAlert(apiAlert({ titleParams: { reference: "#B-1", stray: 7 } }));
    expect(mapped.titleParams).toEqual({ reference: "#B-1" });
  });

  it("carries an acknowledgement through", () => {
    const mapped = mapAlert(
      apiAlert({
        acknowledgement: {
          adminId: "adm-1",
          adminName: "Demo Admin",
          acknowledgedAt: "2026-07-23T09:48:25+05:30",
        },
      }),
    );
    expect(mapped.acknowledgement?.adminName).toBe("Demo Admin");
  });
});

describe("mapTrigger", () => {
  it("words the known rule code and passes the state expressions through mono", () => {
    const trigger = mapTrigger({
      rule: "booking.escalated",
      threshold: "state = ESCALATED",
      actual: "SEARCHING → ESCALATED",
    });
    expect(trigger).toEqual({
      rule: "Booking escalated to ops",
      threshold: "state = ESCALATED",
      actual: "SEARCHING → ESCALATED",
    });
  });

  it("passes an unknown rule code through honestly", () => {
    expect(mapTrigger({ rule: "provider.low_rating", threshold: "x", actual: "y" }).rule).toBe(
      "provider.low_rating",
    );
  });
});

describe("mapHistoryEntry", () => {
  it("words a known event code and keeps the tone", () => {
    const entry = mapHistoryEntry({
      id: "h1",
      at: "2026-07-23T09:46:33+05:30",
      body: "ESCALATE: SEARCHING → ESCALATED",
      tone: "danger",
    });
    expect(entry.body).toBe("Escalated to ops");
    expect(entry.tone).toBe("danger");
  });

  it("passes an unknown event line through untouched", () => {
    const entry = mapHistoryEntry({
      id: "h2",
      at: "2026-07-23T09:46:33+05:30",
      body: "REFUND: ISSUED",
      tone: "info",
    });
    expect(entry.body).toBe("REFUND: ISSUED");
  });
});

describe("mapRelatedRecord", () => {
  it("presents an escalated booking as a danger pill with a composed created line", () => {
    const record = mapRelatedRecord(apiDetail().relatedRecord!);
    expect(record.statusLabel).toBe("Escalated");
    expect(record.statusTone).toBe("danger");
    expect(record.createdLine).toMatch(/^Created \d{1,2}:\d{2} (AM|PM)$/);
    expect(record.amountPaise).toBe(59900);
  });

  it("presents a suspended provider as a danger pill", () => {
    const record = mapRelatedRecord({
      ...apiDetail().relatedRecord!,
      kind: "provider",
      bookingState: null,
      providerStatus: "suspended",
    });
    expect(record.statusLabel).toBe("Suspended");
    expect(record.statusTone).toBe("danger");
  });
});

describe("mapAlertDetail", () => {
  it("maps the live seeded payload end to end", () => {
    const detail = mapAlertDetail(apiDetail());
    expect(detail.description).toBe("Dispatch handed this booking to a human operator.");
    expect(detail.canMute).toBe(false);
    expect(detail.trigger.rule).toBe("Booking escalated to ops");
    expect(detail.history[0]?.body).toBe("Escalated to ops");
    expect(detail.relatedRecord?.statusLabel).toBe("Escalated");
    expect(detail.notes).toEqual([]);
  });
});

describe("mapAcknowledgeResult", () => {
  it("keeps wonRace and maps the receipt's alert — a lost race is information, not an error", () => {
    const result = mapAcknowledgeResult({
      alert: apiAlert({
        acknowledgement: {
          adminId: "adm-2",
          adminName: "Priya Sharma",
          acknowledgedAt: "2026-07-23T09:48:25+05:30",
        },
      }),
      wonRace: false,
    });
    expect(result.wonRace).toBe(false);
    expect(result.alert.acknowledgement?.adminName).toBe("Priya Sharma");
  });
});
