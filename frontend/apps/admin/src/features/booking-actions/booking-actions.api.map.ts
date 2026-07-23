// Pure mappers from the generated rescue payloads (@sethu/api-client) onto this feature's
// normative shapes — every field copied explicitly so a contract drift is a compile error here,
// not a rendering surprise on a money screen. Requests: booking-actions.api.requests.ts; declared
// failure bodies: booking-actions.api.errors.ts.

import type {
  AssignContext as ApiAssignContext,
  AssignOutputBody,
  BookingActionReceipt as ApiBookingActionReceipt,
  BookingActionSubject as ApiBookingActionSubject,
  CallAttempt as ApiCallAttempt,
  CancelContext as ApiCancelContext,
  DispatchRound as ApiDispatchRound,
  ManualCompletionContext as ApiManualCompletionContext,
  ManualCompletionEvidence as ApiManualCompletionEvidence,
  ProviderCandidate as ApiProviderCandidate,
  RankingWeight as ApiRankingWeight,
  RedispatchContext as ApiRedispatchContext,
  RefundContext as ApiRefundContext,
  RefundReceipt as ApiRefundReceipt,
} from "@sethu/api-client";

import type {
  ActionReceipt,
  AssignContext,
  AssignInput,
  BookingActionSubject,
  CallAttempt,
  CancelContext,
  DispatchRound,
  ManualCompletionContext,
  ManualCompletionEvidence,
  ProviderCandidate,
  RankingWeight,
  RedispatchContext,
  RefundContext,
  RefundReceipt,
} from "./booking-actions.types";

/**
 * How the customer paid, as the action screens word it. The server sends the ledger code and the
 * console owns the wording (spec §4.7); an unpaid booking arrives as "" and stays "" so the
 * payment line renders nothing false.
 */
const PAYMENT_METHOD_LABELS: Readonly<Record<string, string>> = {
  UPI: "UPI",
  CASH: "Cash",
  ONLINE: "Online",
};

export function mapActionSubject(subject: ApiBookingActionSubject): BookingActionSubject {
  return {
    bookingId: subject.bookingId,
    reference: subject.reference,
    serviceName: subject.serviceName,
    zone: subject.zone,
    customerName: subject.customerName,
    providerName: subject.providerName,
    amountPaise: subject.amountPaise,
    paymentMethodLabel: PAYMENT_METHOD_LABELS[subject.paymentMethod] ?? "",
    createdAtIso: subject.createdAtIso,
    escalatedMinutes: subject.escalatedMinutes,
    version: subject.version,
  };
}

export function mapDispatchRound(round: ApiDispatchRound): DispatchRound {
  return {
    round: round.round,
    radiusKm: round.radiusKm,
    contacted: round.contacted,
    declined: round.declined,
  };
}

export function mapRankingWeight(weight: ApiRankingWeight): RankingWeight {
  return { factorId: weight.factorId, weight: weight.weight };
}

export function mapCandidate(candidate: ApiProviderCandidate): ProviderCandidate {
  return {
    providerId: candidate.providerId,
    name: candidate.name,
    rating: candidate.rating,
    distanceKm: candidate.distanceKm,
    etaMinutes: candidate.etaMinutes,
    skillLabel: candidate.skill,
    jobsToday: candidate.jobsToday,
    completionRate: candidate.completionRate,
    availability: candidate.availability,
    freeAtIso: candidate.freeAtIso,
    declinedAtIso: candidate.declinedAtIso,
    isBestMatch: candidate.isBestMatch,
  };
}

export function mapAssignContext(payload: ApiAssignContext): AssignContext {
  return {
    booking: mapActionSubject(payload.booking),
    candidates: payload.candidates.map(mapCandidate),
    rounds: payload.rounds.map(mapDispatchRound),
    declinedCount: payload.declinedCount,
    rankingWeights: payload.rankingWeights.map(mapRankingWeight),
    isBlockedOffline: payload.isBlockedOffline,
  };
}

export function mapCancelContext(payload: ApiCancelContext): CancelContext {
  return {
    booking: mapActionSubject(payload.booking),
    policyRefundPaise: payload.policyRefundPaise,
    isPolicyRefundFull: payload.isPolicyRefundFull,
    cancellationFeePaise: payload.cancellationFeePaise,
    technicianOnSite: payload.technicianOnSite,
  };
}

export function mapRedispatchContext(payload: ApiRedispatchContext): RedispatchContext {
  return {
    booking: mapActionSubject(payload.booking),
    rounds: payload.rounds.map(mapDispatchRound),
    declinedCount: payload.declinedCount,
    failedCycles: payload.failedCycles,
    incentiveCapPaise: payload.incentiveCapPaise,
    defaultIncentivePaise: payload.defaultIncentivePaise,
    defaultRadiusId: payload.defaultRadiusId,
  };
}

export function mapCallAttempt(attempt: ApiCallAttempt): CallAttempt {
  return {
    id: attempt.id,
    atIso: attempt.atIso,
    outcome: attempt.outcome,
    durationSeconds: attempt.durationSeconds,
  };
}

export function mapEvidence(evidence: ApiManualCompletionEvidence): ManualCompletionEvidence {
  return {
    workPhotoIds: [...evidence.workPhotoIds],
    completionReportId: evidence.completionReportId,
    completionReportAtIso: evidence.completionReportAtIso,
    callAttempts: evidence.callAttempts.map(mapCallAttempt),
  };
}

export function mapManualCompletionContext(
  payload: ApiManualCompletionContext,
): ManualCompletionContext {
  return {
    booking: mapActionSubject(payload.booking),
    providerName: payload.providerName,
    workReportedAtIso: payload.workReportedAtIso,
    minutesSinceWorkReported: payload.minutesSinceWorkReported,
    availableInMinutes: payload.availableInMinutes,
    evidence: mapEvidence(payload.evidence),
    otpArrivedAtIso: payload.otpArrivedAtIso,
    adminCompletionsThisWeek: payload.adminCompletionsThisWeek,
    providerCompletionsInSevenDays: payload.providerCompletionsInSevenDays,
  };
}

export function mapRefundContext(payload: ApiRefundContext): RefundContext {
  return {
    booking: mapActionSubject(payload.booking),
    bookingValuePaise: payload.bookingValuePaise,
    alreadyRefundedPaise: payload.alreadyRefundedPaise,
    refundablePaise: payload.refundablePaise,
    goodwillCapPaise: payload.goodwillCapPaise,
    refundsUsedThisHour: payload.refundsUsedThisHour,
    refundsAllowedPerHour: payload.refundsAllowedPerHour,
    rateLimitResetsAtIso: payload.rateLimitResetsAtIso,
    providerPayoutPaise: payload.providerPayoutPaise,
    originalMethodLabel: PAYMENT_METHOD_LABELS[payload.originalMethod] ?? "",
    paidAtIso: payload.paidAtIso,
    defaultPayoutImpact: payload.defaultPayoutImpact,
  };
}

export function mapActionReceipt(receipt: ApiBookingActionReceipt): ActionReceipt {
  return { bookingId: receipt.bookingId, version: receipt.version };
}

export function mapRefundReceipt(receipt: ApiRefundReceipt): RefundReceipt {
  return {
    bookingId: receipt.bookingId,
    version: receipt.version,
    refundId: receipt.refundId,
    // No gateway rail yet, so the backend never answers 202/pending — mapped because the contract allows it.
    isPending: receipt.isPending,
    estimatedCompletionIso: receipt.estimatedCompletionIso,
  };
}

/**
 * The assign COMMIT is still the phase-0 `assignBooking` op, whose receipt carries no version —
 * so this echoes the CAS version the operator read, bumped once, exactly as the mock did.
 */
export function assignReceiptFrom(input: AssignInput, body: AssignOutputBody): ActionReceipt {
  return { bookingId: body.booking_id ?? input.bookingId, version: input.version + 1 };
}
