// The generated tail of the mock ledger. The design-exact rows live in `audit.seeds.ts`; these
// exist so the log is large enough to exercise Load more, a 500-row layout and filters that
// actually narrow something — spread across four admins, ten actions and every target type.

import { AUDIT_ACTIONS, type AuditAction, type AuditTarget } from "./audit.types";
import { AUDIT_ADMIN_KEYS, type AuditAdminKey, type AuditSeed } from "./auditSeed";

interface BacklogShape {
  readonly action: AuditAction;
  readonly target: AuditTarget;
  readonly before: Readonly<Record<string, string>>;
  readonly after: Readonly<Record<string, string>>;
  readonly reasonCode?: string;
}

const BACKLOG_SHAPES: readonly BacklogShape[] = [
  {
    action: AUDIT_ACTIONS.applicationApprove,
    target: { type: "application", id: "app_312", reference: "APP-312" },
    before: { status: "Under review" },
    after: { status: "Approved" },
  },
  {
    action: AUDIT_ACTIONS.applicationReject,
    target: { type: "application", id: "app_298", reference: "APP-298" },
    before: { status: "Under review" },
    after: { status: "Rejected" },
    reasonCode: "DOCUMENTS_EXPIRED",
  },
  {
    action: AUDIT_ACTIONS.customerBlock,
    target: { type: "customer", id: "cus_5521", reference: "CUS-5521" },
    before: { status: "Active" },
    after: { status: "Blocked" },
    reasonCode: "CUSTOMER_ABUSE",
  },
  {
    action: AUDIT_ACTIONS.providerForceOffline,
    target: { type: "provider", id: "prv_806", reference: "PRV-806" },
    before: { availability: "Online" },
    after: { availability: "Offline" },
    reasonCode: "REPEATED_CANCELLATIONS",
  },
  {
    action: AUDIT_ACTIONS.bookingRedispatch,
    target: { type: "booking", id: "bkg_8702", reference: "#B-8702" },
    before: { dispatchCycle: "2" },
    after: { dispatchCycle: "3" },
    reasonCode: "SUPPLY_SHORTAGE",
  },
  {
    action: AUDIT_ACTIONS.paymentGoodwill,
    target: { type: "payment", id: "pay_4410", reference: "PAY-4410" },
    before: { credit: "₹0" },
    after: { credit: "₹250" },
    reasonCode: "PARTIAL_SERVICE",
  },
  {
    action: AUDIT_ACTIONS.deviceRevoke,
    target: { type: "device", id: "dev_9a11c4", reference: "dev_9a11c4" },
    before: { trusted: "Yes" },
    after: { trusted: "No" },
    reasonCode: "LOST_DEVICE",
  },
  {
    action: AUDIT_ACTIONS.alertAcknowledge,
    target: { type: "alert", id: "alr_7731", reference: "ALR-7731" },
    before: { state: "Unacknowledged" },
    after: { state: "Acknowledged" },
  },
  {
    action: AUDIT_ACTIONS.providerBlock,
    target: { type: "provider", id: "prv_640", reference: "PRV-640" },
    before: { status: "Suspended" },
    after: { status: "Blocked" },
    reasonCode: "FRAUD_SUSPECTED",
  },
  {
    action: AUDIT_ACTIONS.noteAdd,
    target: { type: "booking", id: "bkg_8688", reference: "#B-8688" },
    before: { notes: "2" },
    after: { notes: "3" },
  },
];

const BACKLOG_ADMINS: readonly AuditAdminKey[] = [
  AUDIT_ADMIN_KEYS.anjali,
  AUDIT_ADMIN_KEYS.vikram,
  AUDIT_ADMIN_KEYS.priya,
  AUDIT_ADMIN_KEYS.ravi,
];

/** Three passes over ten shapes: thirty entries, on top of the fifteen the designs draw. */
const BACKLOG_ROUNDS = 3;
const FIRST_DAY_OF_MONTH = 18;
const ENTRIES_PER_DAY = 5;
const FIRST_HOUR_OF_DAY = 18;

/** Deterministic, so a screenshot taken twice is the same screenshot. */
export function buildBacklogSeeds(): readonly AuditSeed[] {
  return BACKLOG_SHAPES.flatMap((shape, shapeIndex) =>
    Array.from({ length: BACKLOG_ROUNDS }, (_unused, round): AuditSeed => {
      const index = round * BACKLOG_SHAPES.length + shapeIndex;
      const admin = BACKLOG_ADMINS[index % BACKLOG_ADMINS.length] ?? AUDIT_ADMIN_KEYS.ravi;
      const day = FIRST_DAY_OF_MONTH - Math.floor(index / ENTRIES_PER_DAY);
      const hour = FIRST_HOUR_OF_DAY - (index % ENTRIES_PER_DAY) * 2;
      const suffix = String(index + 1).padStart(2, "0");

      return {
        ...shape,
        id: `aud_b${suffix}f3d${suffix}`,
        at: `2026-07-${pad(day)} ${pad(hour)}:${suffix}`,
        admin,
        target: { ...shape.target, id: `${shape.target.id}_${suffix}` },
        evidence: [index % 3, index % 2, 0],
      };
    }),
  );
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
