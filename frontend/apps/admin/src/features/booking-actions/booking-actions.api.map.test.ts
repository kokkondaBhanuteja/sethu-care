import { describe, expect, it } from "vitest";

import type {
  AssignContext as ApiAssignContext,
  BookingActionSubject as ApiBookingActionSubject,
  ManualCompletionContext as ApiManualCompletionContext,
  ProviderCandidate as ApiProviderCandidate,
  RefundContext as ApiRefundContext,
} from "@sethu/api-client";

import {
  assignReceiptFrom,
  mapAssignContext,
  mapManualCompletionContext,
  mapRefundContext,
  mapRefundReceipt,
} from "./booking-actions.api.map";
import { toManualCompleteRequest, toRefundRequest } from "./booking-actions.api.requests";
import type { AssignInput } from "./booking-actions.types";

function subject(overrides: Partial<ApiBookingActionSubject> = {}): ApiBookingActionSubject {
  return {
    bookingId: "b0000000-0000-4000-8000-000000000001",
    reference: "#B-B0000000",
    serviceName: "Deep cleaning",
    zone: "HSR Layout",
    customerName: "Meena Iyer",
    providerName: null,
    amountPaise: 149_900,
    paymentMethod: "UPI",
    createdAtIso: "2026-07-14T05:30:00Z",
    escalatedMinutes: 34,
    version: 4,
    ...overrides,
  };
}

function candidate(overrides: Partial<ApiProviderCandidate> = {}): ApiProviderCandidate {
  return {
    providerId: "p-1",
    name: "Suresh Kumar",
    rating: 4.8,
    distanceKm: 0,
    etaMinutes: 0,
    skill: "Deep cleaning",
    jobsToday: 2,
    completionRate: 0.97,
    availability: "available",
    freeAtIso: null,
    declinedAtIso: null,
    isBestMatch: true,
    ...overrides,
  };
}

describe("mapAssignContext", () => {
  const payload: ApiAssignContext = {
    booking: subject(),
    candidates: [candidate(), candidate({ providerId: "p-2", skill: null, isBestMatch: false })],
    rounds: [{ round: 1, radiusKm: 3, contacted: 0, declined: 0 }],
    declinedCount: 0,
    rankingWeights: [{ factorId: "distance", weight: 0.4 }],
    isBlockedOffline: false,
  };

  it("copies the subject and labels the payment method, '' when unpaid", () => {
    const mapped = mapAssignContext(payload);

    expect(mapped.booking.paymentMethodLabel).toBe("UPI");
    expect(mapped.booking.version).toBe(4);
    // The server sends "" until the booking is paid — an enum miss stays honest, not "Unknown".
    const unpaid = mapAssignContext({
      ...payload,
      booking: subject({ paymentMethod: "" as ApiBookingActionSubject["paymentMethod"] }),
    });
    expect(unpaid.booking.paymentMethodLabel).toBe("");
  });

  it("renames skill to skillLabel and keeps the honest zeros as sent", () => {
    const mapped = mapAssignContext(payload);

    expect(mapped.candidates[0]?.skillLabel).toBe("Deep cleaning");
    expect(mapped.candidates[1]?.skillLabel).toBeNull();
    expect(mapped.candidates[0]?.distanceKm).toBe(0);
    expect(mapped.rounds[0]).toEqual({ round: 1, radiusKm: 3, contacted: 0, declined: 0 });
  });
});

describe("mapManualCompletionContext", () => {
  it("maps the evidence with empty call attempts intact — the gate keys off SUBMITTED ids", () => {
    const payload: ApiManualCompletionContext = {
      booking: subject(),
      providerName: "Suresh Kumar",
      workReportedAtIso: "2026-07-14T06:10:00Z",
      minutesSinceWorkReported: 42,
      availableInMinutes: null,
      evidence: {
        workPhotoIds: ["ph-1"],
        completionReportId: null,
        completionReportAtIso: null,
        callAttempts: [],
      },
      otpArrivedAtIso: null,
      adminCompletionsThisWeek: 1,
      providerCompletionsInSevenDays: 0,
    };

    const mapped = mapManualCompletionContext(payload);

    expect(mapped.evidence.callAttempts).toEqual([]);
    expect(mapped.evidence.workPhotoIds).toEqual(["ph-1"]);
    expect(mapped.availableInMinutes).toBeNull();
  });
});

describe("mapRefundContext", () => {
  it("labels the original method and passes the salaried default through", () => {
    const payload: ApiRefundContext = {
      booking: subject(),
      bookingValuePaise: 149_900,
      alreadyRefundedPaise: 0,
      refundablePaise: 149_900,
      goodwillCapPaise: 50_000,
      refundsUsedThisHour: 0,
      refundsAllowedPerHour: 5,
      rateLimitResetsAtIso: null,
      providerPayoutPaise: 0,
      originalMethod: "ONLINE",
      paidAtIso: "2026-07-14T05:31:00Z",
      defaultPayoutImpact: "pay_anyway",
    };

    const mapped = mapRefundContext(payload);

    expect(mapped.originalMethodLabel).toBe("Online");
    expect(mapped.defaultPayoutImpact).toBe("pay_anyway");
    expect(mapped.providerPayoutPaise).toBe(0);
  });
});

describe("receipts", () => {
  const input: AssignInput = {
    bookingId: "b-1",
    version: 4,
    idempotencyKey: "idem-1",
    providerId: "p-1",
  };

  it("bumps the CAS version once for the phase-0 assign op, which returns none", () => {
    expect(assignReceiptFrom(input, { booking_id: "b-1", state: "ASSIGNED" })).toEqual({
      bookingId: "b-1",
      version: 5,
    });
  });

  it("falls back to the input booking id when the phase-0 body omits it", () => {
    expect(assignReceiptFrom(input, {})).toEqual({ bookingId: "b-1", version: 5 });
  });

  it("keeps a pending refund pending — never reported as done", () => {
    const mapped = mapRefundReceipt({
      bookingId: "b-1",
      version: 6,
      refundId: "rfd-1",
      isPending: true,
      estimatedCompletionIso: "2026-07-21T09:00:00Z",
    });

    expect(mapped.isPending).toBe(true);
    expect(mapped.estimatedCompletionIso).toBe("2026-07-21T09:00:00Z");
  });
});

describe("request builders", () => {
  it("puts the version in the body and clones the readonly evidence arrays", () => {
    const request = toManualCompleteRequest({
      bookingId: "b-1",
      version: 4,
      idempotencyKey: "idem-1",
      reasonCode: "customer_phone_unreachable",
      note: "Customer unreachable after three calls this afternoon.",
      evidence: { workPhotoIds: ["ph-1"], callAttemptIds: ["call-1"], completionReportId: null },
      attestations: { spokeToProvider: true, attemptedCustomer: true, believesWorkDone: true },
    });

    expect(request.version).toBe(4);
    expect(request.evidence.callAttemptIds).toEqual(["call-1"]);
    // The idempotency key travels as a header, never in the body.
    expect("idempotencyKey" in request).toBe(false);
  });

  it("carries the paise amount and payout impact on the refund body", () => {
    const request = toRefundRequest({
      bookingId: "b-1",
      version: 4,
      idempotencyKey: "idem-2",
      refundType: "goodwill_credit",
      amountPaise: 25_000,
      reasonCode: "goodwill_retention",
      note: "",
      payoutImpact: "pay_anyway",
    });

    expect(request).toEqual({
      version: 4,
      refundType: "goodwill_credit",
      amountPaise: 25_000,
      reasonCode: "goodwill_retention",
      note: "",
      payoutImpact: "pay_anyway",
    });
  });
});
