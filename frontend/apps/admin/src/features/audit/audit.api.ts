// The only boundary between the audit screens and their data.
//
// Endpoints (docs/admin-api-contract.md — both MISSING today, served by `audit.mock.ts`):
//   GET /ops/audit?cursor=&limit=&adminId=&action=&targetType=&targetId=&from=&to=
//   GET /ops/audit/{id}
//
// There is no create, update or delete function here and there must never be one: the log is
// append-only at the database level and the API exposes no write path (spec §10.4). Entries are
// written by the actions they record, not by this feature.

import { normalizeError } from "../../lib/http/apiError";
import { fetchAuditAdminsMock, fetchAuditEntryMock, fetchAuditPageMock } from "./audit.mock";
import type { AuditAdmin, AuditEntry, AuditPage, AuditQuery } from "./audit.types";

export async function fetchAuditPage(query: AuditQuery, signal?: AbortSignal): Promise<AuditPage> {
  try {
    return await fetchAuditPageMock(query, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "The audit log could not be loaded.");
  }
}

export async function fetchAuditEntry(entryId: string, signal?: AbortSignal): Promise<AuditEntry> {
  try {
    return await fetchAuditEntryMock(entryId, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "That audit entry could not be loaded.");
  }
}

export async function fetchAuditAdmins(signal?: AbortSignal): Promise<readonly AuditAdmin[]> {
  try {
    return await fetchAuditAdminsMock(signal);
  } catch (thrown) {
    throw normalizeError(thrown, "The admin filter could not be loaded.");
  }
}
