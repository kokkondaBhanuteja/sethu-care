// Query keys and the fixed reason-code vocabularies for the booking actions.
//
// The codes are sent as CODES, never as the operator-facing label — the audit log and the safety
// review both key off them, and a translated string is not an identifier (contract §Reason codes).
// Checked first: `@sethu/domain` and the generated `@sethu/api-client` carry no reason vocabulary
// today, so it is declared here and must be mirrored into `@sethu/domain` when the backend enum
// lands. That mirroring is listed in docs/admin-api-contract.md.

export const BOOKING_ACTION_QUERY_KEYS = {
  assign: (bookingId: string) => ["booking-actions", "assign", bookingId] as const,
  cancel: (bookingId: string) => ["booking-actions", "cancel", bookingId] as const,
  redispatch: (bookingId: string) => ["booking-actions", "redispatch", bookingId] as const,
  manualCompletion: (bookingId: string) =>
    ["booking-actions", "manual-completion", bookingId] as const,
  refund: (bookingId: string) => ["booking-actions", "refund", bookingId] as const,
} as const;

/**
 * Cancellation reasons. "Customer requested" is deliberately absent: after the 60-second window a
 * customer request arrives as a support ticket, not as an ops cancellation
 * (docs/Booking-Workflow-Decisions.md §7, "Changed").
 */
export const CANCEL_REASON_CODES = {
  customerUnreachable: "customer_unreachable",
  duplicateBooking: "duplicate_booking",
  noProviderAvailable: "no_provider_available",
  pricingDispute: "pricing_dispute",
  safetyConcern: "safety_concern",
  testInternal: "test_internal",
  fraudSuspected: "fraud_suspected",
  otherNoteRequired: "other",
  outOfServiceArea: "out_of_service_area",
} as const;

export type CancelReasonCode = (typeof CANCEL_REASON_CODES)[keyof typeof CANCEL_REASON_CODES];

/** The order the design's two-column list reads down, column by column. */
export const CANCEL_REASON_ORDER: readonly CancelReasonCode[] = [
  CANCEL_REASON_CODES.customerUnreachable,
  CANCEL_REASON_CODES.duplicateBooking,
  CANCEL_REASON_CODES.noProviderAvailable,
  CANCEL_REASON_CODES.pricingDispute,
  CANCEL_REASON_CODES.safetyConcern,
  CANCEL_REASON_CODES.testInternal,
  CANCEL_REASON_CODES.fraudSuspected,
  CANCEL_REASON_CODES.otherNoteRequired,
  CANCEL_REASON_CODES.outOfServiceArea,
];

/** These two route the cancellation into a safety review rather than a plain refund. */
export const SAFETY_REVIEW_REASONS: ReadonlySet<CancelReasonCode> = new Set([
  CANCEL_REASON_CODES.safetyConcern,
  CANCEL_REASON_CODES.fraudSuspected,
]);

export const MANUAL_COMPLETION_REASON_CODES = {
  phoneUnreachable: "customer_phone_unreachable",
  leftPremises: "customer_left_premises",
  noSignal: "customer_device_no_signal",
  refusesOtp: "customer_refuses_otp",
  deliveryFailure: "otp_delivery_failure",
  otherNoteRequired: "other",
} as const;

export type ManualCompletionReasonCode =
  (typeof MANUAL_COMPLETION_REASON_CODES)[keyof typeof MANUAL_COMPLETION_REASON_CODES];

export const MANUAL_COMPLETION_REASON_ORDER: readonly ManualCompletionReasonCode[] = [
  MANUAL_COMPLETION_REASON_CODES.phoneUnreachable,
  MANUAL_COMPLETION_REASON_CODES.leftPremises,
  MANUAL_COMPLETION_REASON_CODES.noSignal,
  MANUAL_COMPLETION_REASON_CODES.refusesOtp,
  MANUAL_COMPLETION_REASON_CODES.deliveryFailure,
  MANUAL_COMPLETION_REASON_CODES.otherNoteRequired,
];

export const REFUND_REASON_CODES = {
  serviceNotDelivered: "service_not_delivered",
  duplicatePayment: "duplicate_payment",
  poorServiceQuality: "poor_service_quality",
  policyException: "cancellation_policy_exception",
  providerNoShow: "provider_no_show",
  goodwillRetention: "goodwill_retention",
  overcharged: "overcharged",
  safetyIncident: "safety_incident",
  otherNoteRequired: "other",
} as const;

export type RefundReasonCode = (typeof REFUND_REASON_CODES)[keyof typeof REFUND_REASON_CODES];

export const REFUND_REASON_ORDER: readonly RefundReasonCode[] = [
  REFUND_REASON_CODES.serviceNotDelivered,
  REFUND_REASON_CODES.duplicatePayment,
  REFUND_REASON_CODES.poorServiceQuality,
  REFUND_REASON_CODES.policyException,
  REFUND_REASON_CODES.providerNoShow,
  REFUND_REASON_CODES.goodwillRetention,
  REFUND_REASON_CODES.overcharged,
  REFUND_REASON_CODES.safetyIncident,
  REFUND_REASON_CODES.otherNoteRequired,
];

/** Reasons that withhold the provider payout by default (spec §6.27's impact table). */
export const PROVIDER_AT_FAULT_REASONS: ReadonlySet<RefundReasonCode> = new Set([
  REFUND_REASON_CODES.serviceNotDelivered,
  REFUND_REASON_CODES.poorServiceQuality,
  REFUND_REASON_CODES.providerNoShow,
  REFUND_REASON_CODES.safetyIncident,
]);

export const REFUND_TYPES = {
  full: "full",
  partial: "partial",
  walletCredit: "wallet_credit",
  goodwillCredit: "goodwill_credit",
  waiveFee: "waive_fee",
} as const;

export type RefundTypeId = (typeof REFUND_TYPES)[keyof typeof REFUND_TYPES];

export const REFUND_TYPE_ORDER: readonly RefundTypeId[] = [
  REFUND_TYPES.full,
  REFUND_TYPES.partial,
  REFUND_TYPES.walletCredit,
  REFUND_TYPES.goodwillCredit,
  REFUND_TYPES.waiveFee,
];

/** Wallet, goodwill and fee waivers land immediately; card and UPI reversals take the banking week. */
export const INSTANT_REFUND_TYPES: ReadonlySet<RefundTypeId> = new Set([
  REFUND_TYPES.walletCredit,
  REFUND_TYPES.goodwillCredit,
  REFUND_TYPES.waiveFee,
]);

export const REFUND_PAYOUT_IMPACTS = {
  withhold: "withhold",
  payAnyway: "pay_anyway",
} as const;

export type RefundPayoutImpact =
  (typeof REFUND_PAYOUT_IMPACTS)[keyof typeof REFUND_PAYOUT_IMPACTS];

export const REDISPATCH_RADII = {
  base: "base",
  plus50: "plus_50",
  plus100: "plus_100",
  cityWide: "city_wide",
} as const;

export type RedispatchRadiusId = (typeof REDISPATCH_RADII)[keyof typeof REDISPATCH_RADII];

export const REDISPATCH_RADIUS_ORDER: readonly RedispatchRadiusId[] = [
  REDISPATCH_RADII.base,
  REDISPATCH_RADII.plus50,
  REDISPATCH_RADII.plus100,
  REDISPATCH_RADII.cityWide,
];

export const MANUAL_COMPLETION_STEP_IDS = ["reason", "evidence", "verify", "confirm"] as const;

export type ManualCompletionStepId = (typeof MANUAL_COMPLETION_STEP_IDS)[number];

/** Mirrors of server-enforced limits, used for UX only — the server is the authority (§6.14/§6.27). */
export const NOTE_MAX_LENGTH = 500;
export const MANUAL_COMPLETION_NOTE_MIN_LENGTH = 20;
export const OTHER_REASON_NOTE_MIN_LENGTH = 10;

/** Automation is no longer the likely answer after this many failed cycles (spec §6.13). */
export const EXHAUSTED_DISPATCH_CYCLES = 3;
