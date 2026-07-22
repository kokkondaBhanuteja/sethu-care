// The mock audit service. `GET /ops/audit` and `GET /ops/audit/{id}` do not exist yet — see
// docs/admin-api-contract.md. Filtering and cursor pagination are done here so the screens exercise
// the real shape of the contract (`{ items, total, nextCursor }`) rather than a convenient one.
//
// There is deliberately no write, update or delete mock. The ledger is append-only at the database
// level (spec §10.4), so an "edit entry" function must not exist even in a fixture.

import { mockRead } from "../../mocks/mockTransport";
import { API_ERROR_CODES, apiError } from "../../lib/http/apiError";
import { buildAuditLedger } from "./audit.fixtures";
import {
  AUDIT_RANGES,
  type AuditAdmin,
  type AuditEntry,
  type AuditPage,
  type AuditQuery,
} from "./audit.types";

const LEDGER = buildAuditLedger();

const EMPTY_PAGE: AuditPage = {
  items: [],
  total: 0,
  nextCursor: null,
  rangeFrom: null,
  rangeTo: null,
};

const DAY_MS = 86_400_000;

const RANGE_DAYS: Readonly<Record<string, number>> = {
  [AUDIT_RANGES.today]: 1,
  [AUDIT_RANGES.last7]: 7,
  [AUDIT_RANGES.last30]: 30,
  [AUDIT_RANGES.last90]: 90,
};

/**
 * "Now" is the newest entry, not the wall clock. The fixtures are dated to the approved designs
 * (20 Jul 2026), and a named range resolved against a real clock would empty the log the moment
 * that date passes — which would look like a bug in the screen rather than in the fixture.
 */
function ledgerNow(): number {
  const newest = LEDGER[0];
  return newest ? Date.parse(newest.timestamp) : Date.now();
}

function windowFor(query: AuditQuery): { from: number; to: number } {
  if (query.range === AUDIT_RANGES.custom) {
    return {
      from: query.from ? Date.parse(`${query.from}T00:00:00+05:30`) : Number.NEGATIVE_INFINITY,
      to: query.to ? Date.parse(`${query.to}T23:59:59+05:30`) : Number.POSITIVE_INFINITY,
    };
  }
  const days = RANGE_DAYS[query.range] ?? 7;
  const to = ledgerNow();
  return { from: to - (days - 1) * DAY_MS, to: to + DAY_MS };
}

function matches(
  entry: AuditEntry,
  query: AuditQuery,
  span: { from: number; to: number },
): boolean {
  const at = Date.parse(entry.timestamp);
  if (at < span.from || at > span.to) return false;
  if (query.adminId && entry.admin.id !== query.adminId) return false;
  if (query.action && entry.action !== query.action) return false;
  if (query.targetType && entry.target.type !== query.targetType) return false;

  const term = query.search.trim().toLowerCase();
  if (!term) return true;
  return (
    entry.target.reference.toLowerCase().includes(term) ||
    entry.target.id.toLowerCase().includes(term) ||
    entry.id.toLowerCase().includes(term)
  );
}

function paginate(matched: readonly AuditEntry[], query: AuditQuery): AuditPage {
  const start = query.cursor ? Number.parseInt(query.cursor, 10) : 0;
  const offset = Number.isFinite(start) && start > 0 ? start : 0;
  const items = matched.slice(0, offset + query.limit);
  const nextCursor = items.length < matched.length ? String(items.length) : null;
  const oldest = matched[matched.length - 1];
  const newest = matched[0];

  return {
    items,
    total: matched.length,
    nextCursor,
    rangeFrom: oldest?.timestamp ?? null,
    rangeTo: newest?.timestamp ?? null,
  };
}

export function fetchAuditPageMock(query: AuditQuery, signal?: AbortSignal): Promise<AuditPage> {
  return mockRead(
    () => {
      const span = windowFor(query);
      return paginate(
        LEDGER.filter((entry) => matches(entry, query, span)),
        query,
      );
    },
    { signal, emptyValue: EMPTY_PAGE },
  );
}

export function fetchAuditEntryMock(entryId: string, signal?: AbortSignal): Promise<AuditEntry> {
  return mockRead(
    () => {
      const entry = LEDGER.find((candidate) => candidate.id === entryId);
      if (!entry) {
        throw apiError(API_ERROR_CODES.notFound, "That audit entry does not exist.", {
          status: 404,
        });
      }
      return entry;
    },
    { signal },
  );
}

/** The admins who appear in the ledger, for the Admin filter. Derived, never a second list. */
export function fetchAuditAdminsMock(signal?: AbortSignal): Promise<readonly AuditAdmin[]> {
  return mockRead(
    () => [...new Map(LEDGER.map((entry) => [entry.admin.id, entry.admin])).values()],
    { signal, emptyValue: [] },
  );
}
