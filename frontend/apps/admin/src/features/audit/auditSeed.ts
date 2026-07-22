// The shape the mock fixtures are written in. Seeds are terse on purpose — everything derivable
// (risk level, device, context, the default note for a reason code) is filled in by
// `audit.fixtures.ts`, so a fixture row states only what makes it that row.

import type { AuditAction, AuditStateSnapshot, AuditTarget } from "./audit.types";

export const AUDIT_ADMIN_KEYS = {
  ravi: "ravi",
  priya: "priya",
  anjali: "anjali",
  vikram: "vikram",
} as const;

export type AuditAdminKey = (typeof AUDIT_ADMIN_KEYS)[keyof typeof AUDIT_ADMIN_KEYS];

export interface AuditSeed {
  readonly id: string;
  /** IST wall clock, `YYYY-MM-DD HH:mm`. The ledger is read in IST (spec §4.7). */
  readonly at: string;
  /** Overrides `at` — used only where the spec quotes an exact timestamp. */
  readonly timestamp?: string;
  readonly admin: AuditAdminKey;
  readonly action: AuditAction;
  readonly target: AuditTarget;
  readonly before: AuditStateSnapshot;
  readonly after: AuditStateSnapshot;
  readonly reasonCode?: string;
  /** Overrides the default note for the reason code. */
  readonly note?: string;
  /** `[photos, callLogs, reports]` — omitted means no evidence was attached. */
  readonly evidence?: readonly [number, number, number];
  /** The earlier entry this one corrects. Makes this a compensating entry (BOX 50). */
  readonly compensatesEntryId?: string;
}

export function bookingTarget(reference: string): AuditTarget {
  return { type: "booking", id: `bkg_${reference}`, reference: `#B-${reference}` };
}

export function providerTarget(reference: string): AuditTarget {
  return { type: "provider", id: `prv_${reference}`, reference: `PRV-${reference}` };
}
