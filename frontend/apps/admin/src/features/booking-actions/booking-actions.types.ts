// Shapes for every destructive and financial action the console can run against a booking.
// These are the normative contract until the endpoints in docs/admin-api-contract.md land — that
// document says so explicitly, so a change here is a change to what the backend owes.

import type { RedispatchRadiusId, RefundPayoutImpact } from "./booking-actions.constants";

/** The record header every action screen restates, so the operator never loses the subject. */
export interface BookingActionSubject {
  readonly bookingId: string;
  /** Human reference as the design prints it, e.g. "#B-8823". */
  readonly reference: string;
  readonly serviceName: string;
  readonly zone: string;
  readonly customerName: string;
  readonly providerName: string | null;
  readonly amountPaise: number;
  readonly paymentMethodLabel: string;
  readonly createdAtIso: string;
  readonly escalatedMinutes: number | null;
  /** Optimistic-concurrency token; every mutation sends it back (contract §Conventions). */
  readonly version: number;
}

/** One auto-dispatch round, the "why did this fail" diagnostic (Booking-Workflow-Decisions §3.3). */
export interface DispatchRound {
  readonly round: number;
  readonly radiusKm: number;
  readonly contacted: number;
  readonly declined: number;
}

export type CandidateAvailability = "available" | "onJob" | "declined";

export interface ProviderCandidate {
  readonly providerId: string;
  readonly name: string;
  readonly rating: number;
  readonly distanceKm: number;
  readonly etaMinutes: number;
  readonly skillLabel: string | null;
  readonly jobsToday: number;
  /** 0–1; formatted with formatPercent, never multiplied at the call site. */
  readonly completionRate: number;
  readonly availability: CandidateAvailability;
  readonly freeAtIso: string | null;
  readonly declinedAtIso: string | null;
  readonly isBestMatch: boolean;
}

export interface RankingWeight {
  readonly factorId: string;
  /** 0–1, so formatPercent owns the presentation. */
  readonly weight: number;
}

export interface AssignContext {
  readonly booking: BookingActionSubject;
  readonly candidates: readonly ProviderCandidate[];
  readonly rounds: readonly DispatchRound[];
  readonly declinedCount: number;
  readonly rankingWeights: readonly RankingWeight[];
  /** The server itself refuses to serve a stale candidate list (spec §6.10). */
  readonly isBlockedOffline: boolean;
}

export interface CancelContext {
  readonly booking: BookingActionSubject;
  readonly policyRefundPaise: number;
  readonly isPolicyRefundFull: boolean;
  readonly cancellationFeePaise: number;
  /** Cancelling mid-visit strands two people — the design puts an escape hatch above the form. */
  readonly technicianOnSite: boolean;
}

export interface RedispatchContext {
  readonly booking: BookingActionSubject;
  readonly rounds: readonly DispatchRound[];
  readonly declinedCount: number;
  /** 3 means automation has exhausted itself and the design demotes the primary button. */
  readonly failedCycles: number;
  readonly incentiveCapPaise: number;
  /** The recommended (not default) spend — applied only when the operator taps the preset. */
  readonly defaultIncentivePaise: number;
  /** The suggested pre-selection: one step beyond the last failed round, never a failed radius. */
  readonly defaultRadiusId: RedispatchRadiusId;
}

export interface CallAttempt {
  readonly id: string;
  readonly atIso: string;
  readonly outcome: string;
  readonly durationSeconds: number;
}

export interface ManualCompletionEvidence {
  readonly workPhotoIds: readonly string[];
  readonly completionReportId: string | null;
  readonly completionReportAtIso: string | null;
  readonly callAttempts: readonly CallAttempt[];
}

export interface ManualCompletionContext {
  readonly booking: BookingActionSubject;
  readonly providerName: string;
  readonly workReportedAtIso: string;
  readonly minutesSinceWorkReported: number;
  /** Non-null while the server's 30-minute lock still holds (spec §6.14). */
  readonly availableInMinutes: number | null;
  readonly evidence: ManualCompletionEvidence;
  /** Set when the customer supplied the OTP mid-flow — the manual path yields (spec §7.3). */
  readonly otpArrivedAtIso: string | null;
  readonly adminCompletionsThisWeek: number;
  readonly providerCompletionsInSevenDays: number;
}

export interface RefundContext {
  readonly booking: BookingActionSubject;
  readonly bookingValuePaise: number;
  readonly alreadyRefundedPaise: number;
  readonly refundablePaise: number;
  readonly goodwillCapPaise: number;
  readonly refundsUsedThisHour: number;
  readonly refundsAllowedPerHour: number;
  readonly rateLimitResetsAtIso: string | null;
  readonly providerPayoutPaise: number;
  readonly originalMethodLabel: string;
  readonly paidAtIso: string;
  readonly defaultPayoutImpact: RefundPayoutImpact;
}

// Mutation request/response shapes live next door; re-exported so callers import one module.
export type * from "./booking-actions.inputs";
