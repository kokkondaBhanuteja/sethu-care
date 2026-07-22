// Mock READS for the five booking actions. None of these endpoints exists on the backend yet
// (docs/admin-api-contract.md), so every designed state is produced here, selected by booking id.
// The triggers are listed in this feature's CLAUDE.md.
//
// Mutations — and the server-enforced limits that make them fail — live in
// `booking-actions.writes.mock.ts`.

import { mockRead } from "../../mocks/mockTransport";
import {
  EXHAUSTED_DISPATCH_CYCLES,
  REDISPATCH_RADII,
  REFUND_PAYOUT_IMPACTS,
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
  AssignContext,
  CancelContext,
  ManualCompletionContext,
  RedispatchContext,
  RefundContext,
} from "./booking-actions.types";

function options(signal?: AbortSignal): { signal?: AbortSignal } {
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
      // One step beyond the last failed round (3.0 → 4.5 → 6.0 km all failed), never the radius
      // that already failed — the server suggests the next escalation, not a re-run.
      defaultRadiusId: REDISPATCH_RADII.cityWide,
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
