// Query keys, vocabulary→presentation maps and the filter defaults for the audit log.
//
// The risk vocabulary is NOT redeclared here: `RISK_LEVELS` and `ADMIN_ACTIONS` come from
// `lib/permissions/actions`, the registry mandated by spec §10.2. This file only says how each
// value is drawn.

import {
  ADMIN_ACTIONS,
  RISK_LEVELS,
  type AdminAction,
  type RiskLevel,
} from "../../lib/permissions/actions";
import type { PillTone } from "../../components/ui/Pill";
import {
  AUDIT_ACTIONS,
  AUDIT_RANGES,
  AUDIT_TARGET_TYPES,
  type AuditAction,
  type AuditFilters,
  type AuditRange,
  type AuditTargetType,
} from "./audit.types";

export const AUDIT_QUERY_KEYS = {
  root: ["audit"] as const,
  page: (filters: AuditFilters) => ["audit", "page", filters] as const,
  entry: (entryId: string) => ["audit", "entry", entryId] as const,
};

/** Load-more page size. Audit is a large dataset; the design paginates by count line + Load more. */
export const AUDIT_PAGE_SIZE = 25;

/** The selected entry lives in the URL so a disputed action can be linked to directly. */
export const AUDIT_ENTRY_PARAM = "entry";

export const AUDIT_DEFAULT_FILTERS: AuditFilters = {
  search: "",
  adminId: null,
  action: null,
  targetType: null,
  // The design's filter bar opens on "Last 7 days" (BOX 48).
  range: AUDIT_RANGES.last7,
  from: null,
  to: null,
};

/** Risk level → pill tone, mapped once. The detail view renders `riskLevel` from the §10.4 schema. */
export const RISK_PILL_TONES: Readonly<Record<RiskLevel, PillTone>> = {
  [RISK_LEVELS.none]: "neutral",
  [RISK_LEVELS.low]: "neutral",
  [RISK_LEVELS.medium]: "info",
  [RISK_LEVELS.high]: "warning",
  [RISK_LEVELS.critical]: "danger",
};

/** Action → pill tone, transcribed from the artifacts (BOX 48/50, BOX 75/77). */
export const ACTION_PILL_TONES = {
  BOOKING_ASSIGN: "info",
  BOOKING_REDISPATCH: "info",
  BOOKING_CANCEL: "danger",
  BOOKING_MANUAL_COMPLETE: "warning",
  PAYMENT_REFUND: "warning",
  PAYMENT_REFUND_REVERSE: "warning",
  PAYMENT_GOODWILL: "warning",
  PROVIDER_SUSPEND: "danger",
  PROVIDER_BLOCK: "danger",
  PROVIDER_FORCE_OFFLINE: "info",
  APPLICATION_APPROVE: "success",
  APPLICATION_REJECT: "danger",
  CUSTOMER_BLOCK: "danger",
  DEVICE_REVOKE: "danger",
  ALERT_ACKNOWLEDGE: "neutral",
  NOTE_ADD: "neutral",
} as const satisfies Record<AuditAction, PillTone>;

// The dotted registry id shown in the detail view's "Action" field. Every audited action maps to an
// `ADMIN_ACTIONS` entry except the compensating ones, which have no forward-action policy — they
// exist only to correct an action that has no undo window (§10.3: refund, manual completion).
export const ACTION_REGISTRY_IDS = {
  BOOKING_ASSIGN: ADMIN_ACTIONS.assignProvider,
  BOOKING_REDISPATCH: ADMIN_ACTIONS.redispatch,
  BOOKING_CANCEL: ADMIN_ACTIONS.cancelBooking,
  BOOKING_MANUAL_COMPLETE: ADMIN_ACTIONS.manualComplete,
  PAYMENT_REFUND: ADMIN_ACTIONS.refund,
  PAYMENT_REFUND_REVERSE: "payment.refund_reverse",
  PAYMENT_GOODWILL: ADMIN_ACTIONS.goodwillCredit,
  PROVIDER_SUSPEND: ADMIN_ACTIONS.suspendProvider,
  PROVIDER_BLOCK: ADMIN_ACTIONS.blockProvider,
  PROVIDER_FORCE_OFFLINE: ADMIN_ACTIONS.forceProviderOffline,
  APPLICATION_APPROVE: ADMIN_ACTIONS.approveApplication,
  APPLICATION_REJECT: ADMIN_ACTIONS.rejectApplication,
  CUSTOMER_BLOCK: ADMIN_ACTIONS.blockCustomer,
  DEVICE_REVOKE: ADMIN_ACTIONS.revokeDevice,
  ALERT_ACKNOWLEDGE: ADMIN_ACTIONS.acknowledgeAlert,
  NOTE_ADD: ADMIN_ACTIONS.addNote,
} as const satisfies Record<AuditAction, AdminAction | string>;

export const ACTION_LABEL_KEYS = {
  BOOKING_ASSIGN: "action.BOOKING_ASSIGN",
  BOOKING_REDISPATCH: "action.BOOKING_REDISPATCH",
  BOOKING_CANCEL: "action.BOOKING_CANCEL",
  BOOKING_MANUAL_COMPLETE: "action.BOOKING_MANUAL_COMPLETE",
  PAYMENT_REFUND: "action.PAYMENT_REFUND",
  PAYMENT_REFUND_REVERSE: "action.PAYMENT_REFUND_REVERSE",
  PAYMENT_GOODWILL: "action.PAYMENT_GOODWILL",
  PROVIDER_SUSPEND: "action.PROVIDER_SUSPEND",
  PROVIDER_BLOCK: "action.PROVIDER_BLOCK",
  PROVIDER_FORCE_OFFLINE: "action.PROVIDER_FORCE_OFFLINE",
  APPLICATION_APPROVE: "action.APPLICATION_APPROVE",
  APPLICATION_REJECT: "action.APPLICATION_REJECT",
  CUSTOMER_BLOCK: "action.CUSTOMER_BLOCK",
  DEVICE_REVOKE: "action.DEVICE_REVOKE",
  ALERT_ACKNOWLEDGE: "action.ALERT_ACKNOWLEDGE",
  NOTE_ADD: "action.NOTE_ADD",
} as const satisfies Record<AuditAction, string>;

export const TARGET_TYPE_LABEL_KEYS = {
  booking: "targetType.booking",
  provider: "targetType.provider",
  customer: "targetType.customer",
  application: "targetType.application",
  payment: "targetType.payment",
  device: "targetType.device",
  alert: "targetType.alert",
} as const satisfies Record<AuditTargetType, string>;

export const RISK_LABEL_KEYS = {
  none: "risk.none",
  low: "risk.low",
  medium: "risk.medium",
  high: "risk.high",
  critical: "risk.critical",
} as const satisfies Record<RiskLevel, string>;

export const RANGE_LABEL_KEYS = {
  today: "range.today",
  last7: "range.last7",
  last30: "range.last30",
  last90: "range.last90",
  custom: "range.custom",
} as const satisfies Record<AuditRange, string>;

const REASON_KEYS = {
  CUSTOMER_UNREACHABLE: "reason.CUSTOMER_UNREACHABLE",
  CUSTOMER_LEFT_PREMISES: "reason.CUSTOMER_LEFT_PREMISES",
  OTP_NOT_RECEIVED: "reason.OTP_NOT_RECEIVED",
  SAFETY_CONCERN: "reason.SAFETY_CONCERN",
  ESCALATION_RESCUE: "reason.ESCALATION_RESCUE",
  CUSTOMER_SAFETY_COMPLAINT: "reason.CUSTOMER_SAFETY_COMPLAINT",
  POOR_SERVICE_QUALITY: "reason.POOR_SERVICE_QUALITY",
  DUPLICATE_CHARGE: "reason.DUPLICATE_CHARGE",
  PROVIDER_NO_SHOW: "reason.PROVIDER_NO_SHOW",
  PARTIAL_SERVICE: "reason.PARTIAL_SERVICE",
  CANCELLED_AFTER_ARRIVAL: "reason.CANCELLED_AFTER_ARRIVAL",
  REFUND_ISSUED_IN_ERROR: "reason.REFUND_ISSUED_IN_ERROR",
  DOCUMENTS_EXPIRED: "reason.DOCUMENTS_EXPIRED",
  FRAUD_SUSPECTED: "reason.FRAUD_SUSPECTED",
  REPEATED_CANCELLATIONS: "reason.REPEATED_CANCELLATIONS",
  LOST_DEVICE: "reason.LOST_DEVICE",
  CUSTOMER_ABUSE: "reason.CUSTOMER_ABUSE",
  SUPPLY_SHORTAGE: "reason.SUPPLY_SHORTAGE",
} as const;

export type ReasonLabelKey = (typeof REASON_KEYS)[keyof typeof REASON_KEYS];

/** Indexed by a raw backend code, so an unrecognised code falls back to itself rather than blank. */
export const REASON_LABEL_KEYS: Readonly<Record<string, ReasonLabelKey>> = REASON_KEYS;

/** The mobile quick-filter chips (BOX 75). Each applies one patch; `all` clears them both. */
export const AUDIT_QUICK_FILTERS = [
  { id: "all", labelKey: "quick.all", patch: { targetType: null, action: null } },
  {
    id: "bookings",
    labelKey: "quick.bookings",
    patch: { targetType: AUDIT_TARGET_TYPES.booking, action: null },
  },
  {
    id: "providers",
    labelKey: "quick.providers",
    patch: { targetType: AUDIT_TARGET_TYPES.provider, action: null },
  },
  {
    id: "refunds",
    labelKey: "quick.refunds",
    patch: { targetType: null, action: AUDIT_ACTIONS.paymentRefund },
  },
  {
    id: "cancellations",
    labelKey: "quick.cancellations",
    patch: { targetType: null, action: AUDIT_ACTIONS.bookingCancel },
  },
  {
    id: "suspensions",
    labelKey: "quick.suspensions",
    patch: { targetType: null, action: AUDIT_ACTIONS.providerSuspend },
  },
] as const;
