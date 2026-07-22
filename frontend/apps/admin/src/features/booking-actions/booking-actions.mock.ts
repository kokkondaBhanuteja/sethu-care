// Mock services for the five booking actions. None of these endpoints exists on the backend yet
// (docs/admin-api-contract.md), so every designed state — including the failures — is produced here.
//
// The write rules matter more than the read fixtures: the goodwill cap, the refund rate limit, the
// 30-minute lock and the evidence gates are SERVER-enforced, so the mock enforces them too and the
// screens only mirror the result. A client that decided these itself would be lying about who is
// in charge.

import { API_ERROR_CODES, apiError } from "../../lib/http/apiError";
import { mockRead, mockWrite } from "../../mocks/mockTransport";
import {
  EXHAUSTED_DISPATCH_CYCLES,
  REFUND_PAYOUT_IMPACTS,
  REFUND_TYPES,
  REDISPATCH_RADII,
} from "./booking-actions.constants";
import {
  CALL_ATTEMPTS,
  CANDIDATES,
  COMPLETION_REPORT,
  DISPATCH_ROUNDS,
  FIXTURE_AMOUNTS,
  MOCK_BOOKINGS,
  OTP_ARRIVED_AT_ISO,
  RANKING_WEIGHTS,
  RATE_LIMIT_RESETS_AT_ISO,
  WORK_PHOTO_IDS,
  subjectFor,
} from "./booking-actions.fixtures";
import type {
  ActionReceipt,
  AssignContext,
  AssignInput,
  CancelContext,
  CancelInput,
  ManualCompletionContext,
  ManualCompletionInput,
  RedispatchContext,
  RedispatchInput,
  RefundContext,
  RefundInput,
  RefundReceipt,
} from "./booking-actions.types";

type Signal = { signal?: AbortSignal };

function options(signal?: AbortSignal): Signal {
  return signal ? { signal } : {};
}

export function fetchAssignContextMock(
  bookingId: string,
  signal?: AbortSignal,
): Promise<AssignContext> {
  const empty: AssignContext = {
    booking: subjectFor(bookingId),
    candidates: [],
    rounds: DISPATCH_ROUNDS,
    declinedCount: 8,
    rankingWeights: RANKING_WEIGHTS,
    isBlockedOffline: false,
  };

  return mockRead(
    () => ({
      ...empty,
      candidates: bookingId === MOCK_BOOKINGS.noCandidates ? [] : CANDIDATES,
      isBlockedOffline: bookingId === MOCK_BOOKINGS.offlineBlocked,
    }),
    { ...options(signal), emptyValue: empty },
  );
}

export function fetchCancelContextMock(
  bookingId: string,
  signal?: AbortSignal,
): Promise<CancelContext> {
  return mockRead(
    () => ({
      booking: subjectFor(bookingId),
      policyRefundPaise: FIXTURE_AMOUNTS.bookingValuePaise,
      isPolicyRefundFull: true,
      cancellationFeePaise: FIXTURE_AMOUNTS.cancellationFeePaise,
      technicianOnSite: bookingId === MOCK_BOOKINGS.technicianOnSite,
    }),
    options(signal),
  );
}

export function fetchRedispatchContextMock(
  bookingId: string,
  signal?: AbortSignal,
): Promise<RedispatchContext> {
  return mockRead(
    () => ({
      booking: subjectFor(bookingId),
      rounds: DISPATCH_ROUNDS,
      declinedCount: 8,
      failedCycles: bookingId === MOCK_BOOKINGS.escalated ? EXHAUSTED_DISPATCH_CYCLES : 1,
      incentiveCapPaise: FIXTURE_AMOUNTS.incentiveCapPaise,
      defaultIncentivePaise: FIXTURE_AMOUNTS.defaultIncentivePaise,
      defaultRadiusId: REDISPATCH_RADII.plus100,
    }),
    options(signal),
  );
}

export function fetchManualCompletionContextMock(
  bookingId: string,
  signal?: AbortSignal,
): Promise<ManualCompletionContext> {
  const hasCallAttempts = bookingId !== MOCK_BOOKINGS.evidenceMissing;

  return mockRead(
    () => ({
      booking: subjectFor(bookingId),
      providerName: "Suresh Mehta",
      workReportedAtIso: COMPLETION_REPORT.workReportedAtIso,
      minutesSinceWorkReported: 42,
      availableInMinutes: bookingId === MOCK_BOOKINGS.tooEarly ? 18 : null,
      evidence: {
        workPhotoIds: WORK_PHOTO_IDS,
        completionReportId: COMPLETION_REPORT.id,
        completionReportAtIso: COMPLETION_REPORT.submittedAtIso,
        callAttempts: hasCallAttempts ? CALL_ATTEMPTS : [],
      },
      otpArrivedAtIso: bookingId === MOCK_BOOKINGS.otpArrived ? OTP_ARRIVED_AT_ISO : null,
      adminCompletionsThisWeek: 1,
      providerCompletionsInSevenDays: bookingId === MOCK_BOOKINGS.otpArrived ? 1 : 3,
    }),
    options(signal),
  );
}

export function fetchRefundContextMock(
  bookingId: string,
  signal?: AbortSignal,
): Promise<RefundContext> {
  const isRateLimited = bookingId === MOCK_BOOKINGS.refundRateLimited;

  return mockRead(
    () => ({
      booking: subjectFor(bookingId),
      bookingValuePaise: FIXTURE_AMOUNTS.bookingValuePaise,
      alreadyRefundedPaise: 0,
      refundablePaise: FIXTURE_AMOUNTS.bookingValuePaise,
      goodwillCapPaise: FIXTURE_AMOUNTS.goodwillCapPaise,
      refundsUsedThisHour: isRateLimited ? 10 : 3,
      refundsAllowedPerHour: 10,
      rateLimitResetsAtIso: isRateLimited ? RATE_LIMIT_RESETS_AT_ISO : null,
      providerPayoutPaise: FIXTURE_AMOUNTS.providerPayoutPaise,
      originalMethodLabel: "UPI ····4242",
      paidAtIso: FIXTURE_AMOUNTS.paidAtIso,
      defaultPayoutImpact: REFUND_PAYOUT_IMPACTS.withhold,
    }),
    options(signal),
  );
}

function receipt(input: { bookingId: string; version: number }): ActionReceipt {
  return { bookingId: input.bookingId, version: input.version + 1 };
}

export function submitAssignMock(input: AssignInput, signal?: AbortSignal): Promise<ActionReceipt> {
  return mockWrite(() => receipt(input), options(signal));
}

export function submitCancelMock(input: CancelInput, signal?: AbortSignal): Promise<ActionReceipt> {
  return mockWrite(() => receipt(input), options(signal));
}

export function submitRedispatchMock(
  input: RedispatchInput,
  signal?: AbortSignal,
): Promise<ActionReceipt> {
  return mockWrite(() => {
    if (input.incentivePaise > FIXTURE_AMOUNTS.incentiveCapPaise) {
      throw apiError(API_ERROR_CODES.validation, "The incentive exceeds the cap.", {
        status: 422,
        fieldErrors: { incentiveRupees: "Above the 50% cap for this booking." },
      });
    }
    return receipt(input);
  }, options(signal));
}

export function submitManualCompletionMock(
  input: ManualCompletionInput,
  signal?: AbortSignal,
): Promise<ActionReceipt> {
  return mockWrite(() => {
    if (input.bookingId === MOCK_BOOKINGS.tooEarly) {
      throw apiError(API_ERROR_CODES.conflict, "Manual completion is not available yet.", {
        status: 409,
      });
    }
    if (input.evidence.callAttemptIds.length === 0) {
      throw apiError(API_ERROR_CODES.validation, "Log a call attempt to continue.", { status: 422 });
    }
    return receipt(input);
  }, options(signal));
}

export function submitRefundMock(input: RefundInput, signal?: AbortSignal): Promise<RefundReceipt> {
  return mockWrite(() => {
    if (input.bookingId === MOCK_BOOKINGS.refundRateLimited) {
      throw apiError(API_ERROR_CODES.rateLimited, "Refund limit reached.", { status: 429 });
    }
    if (
      input.refundType === REFUND_TYPES.goodwillCredit &&
      input.amountPaise > FIXTURE_AMOUNTS.goodwillCapPaise
    ) {
      throw apiError(API_ERROR_CODES.validation, "Amount exceeds the goodwill cap.", {
        status: 422,
        fieldErrors: { amountRupees: "Above the goodwill cap." },
      });
    }
    return {
      ...receipt(input),
      refundId: `rfd_${input.idempotencyKey.slice(0, 8)}`,
      isPending: input.bookingId === MOCK_BOOKINGS.goodwillCapExceeded,
      estimatedCompletionIso: "2026-07-27T09:42:00.000Z",
    };
  }, options(signal));
}
