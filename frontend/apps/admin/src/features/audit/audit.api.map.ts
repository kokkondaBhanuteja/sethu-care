// Pure mappers between this feature's normative audit shapes (audit.types.ts, from Admin spec
// §10.4) and the generated /ops/audit payloads (@sethu/api-client). Every field is copied
// explicitly so a contract drift is a compile error here rather than a rendering surprise.

import type { AuditEntry as ApiAuditEntry, AuditPage as ApiAuditPage } from "@sethu/api-client";

import { AUDIT_RANGES } from "./audit.types";
import type {
  AuditAction,
  AuditEntry,
  AuditPage,
  AuditQuery,
  AuditTargetType,
} from "./audit.types";

export interface ListAuditParams {
  readonly adminId?: string;
  readonly action?: AuditAction;
  readonly targetType?: AuditTargetType;
  readonly targetId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly limit: number;
  readonly cursor?: string;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight of the given instant's IST calendar day, as UTC (§4.7: the console's clock is IST). */
function startOfIstDay(instant: Date): Date {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

/** A `yyyy-mm-dd` date-input value, read as an IST calendar day. */
function istDayStart(dayValue: string): Date {
  return new Date(`${dayValue}T00:00:00+05:30`);
}

/**
 * The named ranges the design offers (BOX 48) as the server's inclusive-`from` / exclusive-`to`
 * pair. "Last 7/30/90 days" include today plus the N-1 IST days before it; "Today" starts at IST
 * midnight; both leave `to` open so nothing written mid-request is missed.
 */
export function auditRangeBounds(
  query: Pick<AuditQuery, "range" | "from" | "to">,
  now: Date = new Date(),
): { from?: string; to?: string } {
  switch (query.range) {
    case AUDIT_RANGES.today:
      return { from: startOfIstDay(now).toISOString() };
    case AUDIT_RANGES.last7:
      return { from: new Date(startOfIstDay(now).getTime() - 6 * DAY_MS).toISOString() };
    case AUDIT_RANGES.last30:
      return { from: new Date(startOfIstDay(now).getTime() - 29 * DAY_MS).toISOString() };
    case AUDIT_RANGES.last90:
      return { from: new Date(startOfIstDay(now).getTime() - 89 * DAY_MS).toISOString() };
    case AUDIT_RANGES.custom:
      return {
        ...(query.from ? { from: istDayStart(query.from).toISOString() } : {}),
        // The bound is exclusive, so "to 20 Jul" means "before 21 Jul 00:00 IST".
        ...(query.to
          ? { to: new Date(istDayStart(query.to).getTime() + DAY_MS).toISOString() }
          : {}),
      };
  }
}

export function toListAuditParams(query: AuditQuery, now: Date = new Date()): ListAuditParams {
  const search = query.search.trim();
  return {
    ...(query.adminId !== null ? { adminId: query.adminId } : {}),
    ...(query.action !== null ? { action: query.action } : {}),
    ...(query.targetType !== null ? { targetType: query.targetType } : {}),
    // The design's one free-text filter is a target-id search (spec §6.29).
    ...(search.length > 0 ? { targetId: search } : {}),
    ...auditRangeBounds(query, now),
    limit: query.limit,
    ...(query.cursor !== null ? { cursor: query.cursor } : {}),
  };
}

export function mapAuditEntry(entry: ApiAuditEntry): AuditEntry {
  return {
    id: entry.id,
    timestamp: entry.timestamp,
    admin: { id: entry.admin.id, name: entry.admin.name, email: entry.admin.email },
    action: entry.action,
    riskLevel: entry.riskLevel,
    target: {
      type: entry.target.type,
      id: entry.target.id,
      reference: entry.target.reference,
    },
    before: { ...entry.before },
    after: { ...entry.after },
    reason: entry.reason ? { code: entry.reason.code, note: entry.reason.note } : null,
    evidence: {
      photoIds: [...entry.evidence.photoIds],
      callLogIds: [...entry.evidence.callLogIds],
      reportIds: [...entry.evidence.reportIds],
    },
    context: {
      surface: entry.context.surface,
      appVersion: entry.context.appVersion,
      otaBundle: entry.context.otaBundle,
      deviceId: entry.context.deviceId,
      deviceName: entry.context.deviceName,
      ipAddress: entry.context.ipAddress,
      approximateLocation: entry.context.approximateLocation,
      stepUpVerified: entry.context.stepUpVerified,
    },
    immutable: true,
    compensatesEntryId: entry.compensatesEntryId,
    compensatedByEntryId: entry.compensatedByEntryId,
  };
}

export function mapAuditPage(payload: ApiAuditPage): AuditPage {
  return {
    items: payload.items.map(mapAuditEntry),
    total: payload.total,
    nextCursor: payload.nextCursor,
    rangeFrom: payload.rangeFrom,
    rangeTo: payload.rangeTo,
  };
}
