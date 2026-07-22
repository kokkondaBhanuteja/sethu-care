// The audit entry, typed from Admin spec §10.4 — that JSON schema is normative and this file
// mirrors it field for field. Two fields are added beyond it, both required by the design and by
// docs/admin-api-contract.md (`GET /ops/audit/{id}` — "the compensating-entry link"):
// `compensatesEntryId` and `compensatedByEntryId`. Nothing here is optional-by-convenience: an
// audit record whose shape varies is an audit record you cannot reason about.

import type { RiskLevel } from "../../lib/permissions/actions";

/** The kinds of record an administrative mutation can target (spec §6.29 "target type" filter). */
export const AUDIT_TARGET_TYPES = {
  booking: "booking",
  provider: "provider",
  customer: "customer",
  application: "application",
  payment: "payment",
  device: "device",
  alert: "alert",
} as const;

export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[keyof typeof AUDIT_TARGET_TYPES];

/**
 * The audited action vocabulary. SCREAMING_SNAKE because that is what §10.4 records
 * (`"action": "BOOKING_MANUAL_COMPLETE"`); the dotted `lib/permissions/actions` id is a separate
 * mapping in `audit.constants.ts`, not a second vocabulary.
 */
export const AUDIT_ACTIONS = {
  bookingAssign: "BOOKING_ASSIGN",
  bookingRedispatch: "BOOKING_REDISPATCH",
  bookingCancel: "BOOKING_CANCEL",
  bookingManualComplete: "BOOKING_MANUAL_COMPLETE",
  paymentRefund: "PAYMENT_REFUND",
  /** A compensating action: it reverses PAYMENT_REFUND and is itself audited (§10.4 guarantees). */
  paymentRefundReverse: "PAYMENT_REFUND_REVERSE",
  paymentGoodwill: "PAYMENT_GOODWILL",
  providerSuspend: "PROVIDER_SUSPEND",
  providerBlock: "PROVIDER_BLOCK",
  providerForceOffline: "PROVIDER_FORCE_OFFLINE",
  applicationApprove: "APPLICATION_APPROVE",
  applicationReject: "APPLICATION_REJECT",
  customerBlock: "CUSTOMER_BLOCK",
  deviceRevoke: "DEVICE_REVOKE",
  alertAcknowledge: "ALERT_ACKNOWLEDGE",
  noteAdd: "NOTE_ADD",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** Which client the mutation was made from — `context.surface` in §10.4. */
export const AUDIT_SURFACES = { mobile: "mobile", desktop: "desktop" } as const;

export type AuditSurface = (typeof AUDIT_SURFACES)[keyof typeof AUDIT_SURFACES];

export interface AuditAdmin {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export interface AuditTarget {
  readonly type: AuditTargetType;
  /** The record's primary key, e.g. `bkg_8823`. */
  readonly id: string;
  /** The human reference an operator recognises, e.g. `#B-8823`. */
  readonly reference: string;
}

export interface AuditReason {
  readonly code: string;
  readonly note: string;
}

export interface AuditEvidence {
  readonly photoIds: readonly string[];
  readonly callLogIds: readonly string[];
  readonly reportIds: readonly string[];
}

/**
 * A state snapshot: field name → display value. Values arrive display-ready (`"₹1,499"`,
 * `"Waiting Completion OTP"`) because the audit log is a record of what an operator was told at
 * the time, not a re-render of today's vocabulary.
 */
export type AuditStateSnapshot = Readonly<Record<string, string>>;

export interface AuditContext {
  readonly surface: AuditSurface;
  readonly appVersion: string;
  readonly otaBundle: string;
  readonly deviceId: string;
  readonly deviceName: string;
  /** Sensitive — detail view only, never the list, never the console (spec §6.29 Privacy). */
  readonly ipAddress: string;
  /** City-level only, captured for mutations alone (spec §10.4 "Location capture"). */
  readonly approximateLocation: string;
  readonly stepUpVerified: boolean;
}

export interface AuditEntry {
  readonly id: string;
  /** RFC 3339 UTC; rendered IST by `lib/format`. */
  readonly timestamp: string;
  readonly admin: AuditAdmin;
  readonly action: AuditAction;
  readonly riskLevel: RiskLevel;
  readonly target: AuditTarget;
  readonly before: AuditStateSnapshot;
  readonly after: AuditStateSnapshot;
  /** Null for actions the risk register does not require a reason for (§10.3). */
  readonly reason: AuditReason | null;
  readonly evidence: AuditEvidence;
  readonly context: AuditContext;
  /** Always true. Present in the payload so the guarantee travels with the record (§10.4). */
  readonly immutable: true;
  /** Set on a compensating entry: the earlier entry this one corrects. */
  readonly compensatesEntryId: string | null;
  /** Set on the corrected entry. The original is NOT modified — the backend derives this link. */
  readonly compensatedByEntryId: string | null;
}

/** Named ranges, because the design has no calendar on the filter bar (BOX 48). */
export const AUDIT_RANGES = {
  today: "today",
  last7: "last7",
  last30: "last30",
  last90: "last90",
  custom: "custom",
} as const;

export type AuditRange = (typeof AUDIT_RANGES)[keyof typeof AUDIT_RANGES];

export interface AuditFilters {
  /** Target ID search — the only free-text filter the design offers. */
  readonly search: string;
  readonly adminId: string | null;
  readonly action: AuditAction | null;
  readonly targetType: AuditTargetType | null;
  readonly range: AuditRange;
  /** `yyyy-mm-dd` from a native date input; only read when `range` is `custom`. */
  readonly from: string | null;
  readonly to: string | null;
}

export interface AuditQuery extends AuditFilters {
  readonly cursor: string | null;
  readonly limit: number;
}

export interface AuditPage {
  readonly items: readonly AuditEntry[];
  readonly total: number;
  readonly nextCursor: string | null;
  /** Oldest → newest timestamps actually present, for the "4 entries · 20 Jul – 20 Jul" line. */
  readonly rangeFrom: string | null;
  readonly rangeTo: string | null;
}
