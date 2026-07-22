// Builds the mock ledger: the design-exact seeds plus the generated backlog.
//
// Risk level is NOT restated here — it is read from the action registry in `lib/permissions/actions`
// (spec §10.2/§10.3), which is the same source the real backend classifies against.

import { ACTION_POLICIES, RISK_LEVELS, type RiskLevel } from "../../lib/permissions/actions";
import { ACTION_REGISTRY_IDS } from "./audit.constants";
import {
  AUDIT_SURFACES,
  type AuditAction,
  type AuditAdmin,
  type AuditContext,
  type AuditEntry,
} from "./audit.types";
import { AUDIT_DESIGN_SEEDS } from "./audit.seeds";
import type { AuditAdminKey, AuditSeed } from "./auditSeed";
import { buildBacklogSeeds } from "./audit.backlog";

interface AuditPerson {
  readonly admin: AuditAdmin;
  readonly context: Omit<AuditContext, "stepUpVerified">;
}

/** Ravi Kumar's record and device are the Admin spec §10.4 example, field for field. */
export const AUDIT_PEOPLE: Readonly<Record<AuditAdminKey, AuditPerson>> = {
  ravi: {
    admin: { id: "adm_44", name: "Ravi Kumar", email: "ravi@setucare.in" },
    context: {
      surface: AUDIT_SURFACES.mobile,
      appVersion: "1.0.0",
      otaBundle: "b_142",
      deviceId: "dev_a1b2c3",
      deviceName: "iPhone 14",
      ipAddress: "49.207.x.x",
      approximateLocation: "Hyderabad, TS",
    },
  },
  priya: {
    admin: { id: "adm_011", name: "Priya Sharma", email: "priya@setucare.in" },
    context: {
      surface: AUDIT_SURFACES.desktop,
      appVersion: "1.0.0",
      otaBundle: "b_142",
      deviceId: "dev_c9d4e1",
      deviceName: "Pixel 8",
      ipAddress: "49.207.x.x",
      approximateLocation: "Hyderabad, TS",
    },
  },
  anjali: {
    admin: { id: "adm_017", name: "Anjali Rao", email: "anjali@setucare.in" },
    context: {
      surface: AUDIT_SURFACES.desktop,
      appVersion: "1.0.0",
      otaBundle: "b_141",
      deviceId: "dev_71fa08",
      deviceName: "MacBook Pro",
      ipAddress: "103.21.x.x",
      approximateLocation: "Bengaluru, KA",
    },
  },
  vikram: {
    admin: { id: "adm_023", name: "Vikram Iyer", email: "vikram@setucare.in" },
    context: {
      surface: AUDIT_SURFACES.mobile,
      appVersion: "1.0.0",
      otaBundle: "b_142",
      deviceId: "dev_5e2b90",
      deviceName: "Pixel 7",
      ipAddress: "103.21.x.x",
      approximateLocation: "Hyderabad, TS",
    },
  },
};

/** The note an admin typed, defaulted per reason code so every seed does not have to carry one. */
const DEFAULT_NOTES: Readonly<Record<string, string>> = {
  CUSTOMER_UNREACHABLE: "Customer could not be reached on either number.",
  CUSTOMER_LEFT_PREMISES: "Customer left before the technician finished.",
  OTP_NOT_RECEIVED: "Completion OTP never arrived; technician photos verified instead.",
  SAFETY_CONCERN: "Technician reported an unsafe situation at the address.",
  ESCALATION_RESCUE: "Auto-dispatch exhausted its cycles; assigned by hand.",
  CUSTOMER_SAFETY_COMPLAINT: "Customer reported unsafe conduct. Escalated to the safety desk.",
  POOR_SERVICE_QUALITY: "Work was not completed to standard.",
  DUPLICATE_CHARGE: "Customer was charged twice for the same visit.",
  PROVIDER_NO_SHOW: "Provider never arrived and did not respond.",
  PARTIAL_SERVICE: "Only part of the requested work was completed.",
  CANCELLED_AFTER_ARRIVAL: "Customer cancelled once the technician was on site.",
  REFUND_ISSUED_IN_ERROR: "Refund was raised against the wrong booking.",
  DOCUMENTS_EXPIRED: "Police verification lapsed and was not renewed in time.",
  FRAUD_SUSPECTED: "Payment pattern flagged by the risk queue.",
  REPEATED_CANCELLATIONS: "Fourth late cancellation inside seven days.",
  LOST_DEVICE: "Admin reported the handset lost.",
  CUSTOMER_ABUSE: "Abusive language toward two technicians.",
  SUPPLY_SHORTAGE: "Zone had no online provider for over an hour.",
};

const POLICY_BY_ID = new Map(Object.entries(ACTION_POLICIES));

/** Risk comes from the registry; a compensating action has no forward policy, so it inherits high. */
function riskFor(action: AuditAction): RiskLevel {
  return POLICY_BY_ID.get(ACTION_REGISTRY_IDS[action])?.risk ?? RISK_LEVELS.high;
}

function toIso(istWallClock: string): string {
  const [day = "", time = "00:00"] = istWallClock.split(" ");
  return new Date(`${day}T${time}:00+05:30`).toISOString();
}

function ids(prefix: string, count: number): readonly string[] {
  return Array.from({ length: count }, (_unused, index) => `${prefix}_${index + 1}`);
}

function buildEntry(seed: AuditSeed): AuditEntry {
  const person = AUDIT_PEOPLE[seed.admin];
  const [photos = 0, callLogs = 0, reports = 0] = seed.evidence ?? [];
  const risk = riskFor(seed.action);
  const note = seed.note ?? (seed.reasonCode ? (DEFAULT_NOTES[seed.reasonCode] ?? "") : "");

  return {
    id: seed.id,
    timestamp: seed.timestamp ?? toIso(seed.at),
    admin: person.admin,
    action: seed.action,
    riskLevel: risk,
    target: seed.target,
    before: seed.before,
    after: seed.after,
    reason: seed.reasonCode ? { code: seed.reasonCode, note } : null,
    evidence: {
      photoIds: ids("ph", photos),
      callLogIds: ids("cl", callLogs),
      reportIds: ids("rp", reports),
    },
    context: {
      ...person.context,
      stepUpVerified: risk === RISK_LEVELS.high || risk === RISK_LEVELS.critical,
    },
    immutable: true,
    compensatesEntryId: seed.compensatesEntryId ?? null,
    compensatedByEntryId: null,
  };
}

/**
 * Newest first — the ledger reads top-down, so a compensating entry sits above the entry it
 * corrects. The back-link on the corrected entry is derived, never written onto it: the original
 * record is not modified by being corrected (spec §10.4, design BOX 50).
 */
export function buildAuditLedger(): readonly AuditEntry[] {
  const entries = [...AUDIT_DESIGN_SEEDS, ...buildBacklogSeeds()].map(buildEntry);
  const correctedBy = new Map(
    entries.flatMap((entry) =>
      entry.compensatesEntryId ? [[entry.compensatesEntryId, entry.id] as const] : [],
    ),
  );

  return entries
    .map((entry) => ({ ...entry, compensatedByEntryId: correctedBy.get(entry.id) ?? null }))
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}
