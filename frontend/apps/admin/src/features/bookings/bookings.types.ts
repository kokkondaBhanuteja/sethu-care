// Shapes for GET /ops/bookings and GET /ops/bookings/{id} (docs/admin-api-contract.md — both are
// still MISSING, so bookings.mock.ts is the normative implementation until the backend lands).
//
// Every human-readable fragment is modelled as data plus a discriminant, never as a pre-built
// sentence: the timeline and the provider line are the two places an English string would otherwise
// leak out of the API and past @sethu/i18n.

import type { BookingSegment, BookingState } from "./bookings.constants";

/** One auto-dispatch round — the "why did this fail" diagnostic (Booking-Workflow-Decisions §3.3). */
export interface DispatchRound {
  readonly number: number;
  readonly radiusKm: number;
  readonly contacted: number;
  readonly declined: number;
}

export type ProviderNote =
  | { readonly kind: "none" }
  | { readonly kind: "unassignedFor"; readonly minutes: number }
  | { readonly kind: "eta"; readonly minutes: number }
  | { readonly kind: "startedAt"; readonly at: string }
  | { readonly kind: "arrivedAgo"; readonly minutes: number }
  | { readonly kind: "rating"; readonly rating: number };

export interface BookingListItem {
  readonly id: string;
  /** The operator-facing reference, mono-set throughout the design: `#B-8823`. */
  readonly reference: string;
  readonly state: BookingState;
  /** COMPLETED asserted by an admin rather than proved by the customer's OTP (spec §4.3). */
  readonly isAdminVerified: boolean;
  readonly serviceName: string;
  readonly customerName: string;
  /** E.164 — formatted for display by lib/format, highlighted in place when it is the search key. */
  readonly customerPhone: string;
  readonly area: string;
  readonly slotAt: string;
  readonly amountPaise: number;
  readonly providerName: string | null;
  readonly providerNote: ProviderNote;
}

export interface BookingSegmentCounts {
  readonly active: number;
  readonly completed: number;
  readonly cancelled: number;
  /** Drives the pulsing dot on the Active tab — the segment contains at least one escalation. */
  readonly activeHasEscalation: boolean;
}

export interface BookingsPage {
  readonly items: readonly BookingListItem[];
  /** Rows the query matches in total, which is what the count line and Load more compare against. */
  readonly total: number;
  readonly counts: BookingSegmentCounts;
  /** True when the result set spans every segment, i.e. a search rather than a segment browse. */
  readonly isAcrossSegments: boolean;
}

export interface BookingsQuery {
  readonly segment: BookingSegment;
  readonly search: string;
  readonly states: readonly BookingState[];
  readonly limit: number;
}

export type BookingEventKind =
  | "created"
  | "searching"
  | "dispatchRound"
  | "autoAssigned"
  | "enRoute"
  | "arrived"
  | "started"
  | "completionOtpFailed"
  | "completed"
  | "completedByAdmin"
  | "assignmentFailed"
  | "escalated"
  | "cancelled";

export interface BookingEvent {
  readonly id: string;
  readonly at: string;
  readonly kind: BookingEventKind;
  readonly round?: DispatchRound;
  /** Named where the event turns on who did it — an admin-verified completion, a manual assign. */
  readonly actorName?: string;
  readonly providerName?: string;
}

export interface BookingCustomer {
  readonly name: string;
  readonly phone: string;
  readonly address: string;
  readonly bookingCount: number;
  readonly joinedAt: string;
}

export interface BookingProvider {
  readonly id: string;
  readonly name: string;
  readonly rating: number;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

export interface BookingPayment {
  readonly amountPaise: number;
  readonly isPrepaid: boolean;
  readonly methodLabel: string;
  readonly last4: string;
  readonly paidAt: string;
  readonly transactionId: string;
}

/** Why a booking is on the escalation queue, as the danger banner states it. */
export interface BookingEscalation {
  /** Sent as an elapsed count, not a timestamp: the banner states an age, and the server's clock
   *  is the authoritative one (admin-api-contract conventions). */
  readonly minutesUnresolved: number;
  readonly rounds: number;
  readonly declined: number;
}

/** The accountability trail behind an admin-asserted completion (spec §6.14). */
export interface BookingVerification {
  readonly verifiedByName: string;
  readonly verifiedAt: string;
  readonly disputeWindowClosesAt: string;
}

/**
 * Someone else moved this record while it was open here. Rendered as the informational banner in
 * BOX 9 / M11, never applied silently — re-rendering under the operator's thumb mid-tap is how the
 * wrong button gets pressed.
 */
export interface BookingConcurrentChange {
  readonly actorName: string;
  readonly providerName: string;
  readonly at: string;
}

export interface BookingAdminActivity {
  readonly id: string;
  readonly at: string;
  readonly kind: "viewed" | "systemEscalated" | "systemAutoAssigned" | "verifiedCompletion";
  readonly actorName?: string;
}

export interface BookingDetail {
  readonly id: string;
  readonly reference: string;
  readonly state: BookingState;
  readonly isAdminVerified: boolean;
  /** Optimistic concurrency token; a stale one comes back 409 (admin-api-contract conventions). */
  readonly version: number;
  readonly serviceTitle: string;
  readonly area: string;
  readonly amountPaise: number;
  readonly createdAt: string;
  readonly escalation: BookingEscalation | null;
  readonly dispatchRounds: readonly DispatchRound[];
  readonly declinedTotal: number;
  readonly customer: BookingCustomer;
  readonly provider: BookingProvider | null;
  readonly payment: BookingPayment;
  readonly verification: BookingVerification | null;
  readonly concurrentChange: BookingConcurrentChange | null;
  readonly timeline: readonly BookingEvent[];
  readonly adminActivity: readonly BookingAdminActivity[];
  readonly notes: readonly string[];
}
