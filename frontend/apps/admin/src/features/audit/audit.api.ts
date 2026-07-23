// The only boundary between the audit screens and their data.
//
// `GET /ops/audit` is real (backend commit 6543b30) and served through the generated client when
// mocks are off; the mock branch is untouched, so unit tests and e2e runs behave exactly as
// before. The entry detail and the admins filter are still mock-only — see the dated notes.
//
// There is no create, update or delete function here and there must never be one: the log is
// append-only at the database level and the API exposes no write path (spec §10.4). Entries are
// written by the actions they record, not by this feature.

import { opsListAuditEntries } from "@sethu/api-client";

import { env } from "../../lib/env";
import { normalizeError } from "../../lib/http/apiError";
import { mapAuditPage, toListAuditParams } from "./audit.api.map";
import { fetchAuditAdminsMock, fetchAuditEntryMock, fetchAuditPageMock } from "./audit.mock";
import type { AuditAdmin, AuditEntry, AuditPage, AuditQuery } from "./audit.types";

export async function fetchAuditPage(query: AuditQuery, signal?: AbortSignal): Promise<AuditPage> {
  try {
    if (env.useMocks) return await fetchAuditPageMock(query, signal);

    const result = await opsListAuditEntries({ query: toListAuditParams(query), signal });
    if (result.data === undefined) throw result.response;
    return mapAuditPage(result.data);
  } catch (thrown) {
    throw normalizeError(thrown, "The audit log could not be loaded.");
  }
}

export async function fetchAuditEntry(entryId: string, signal?: AbortSignal): Promise<AuditEntry> {
  try {
    // 2026-07-23: `GET /ops/audit/{id}` still answers 501 (not in backend commit 6543b30's six
    // endpoint groups), so the detail stays on its mock in every mode. Flip to `opsGetAuditEntry`
    // when it lands. In real mode this is unreachable today: the real list is what offers a
    // selection, and it opens entries by its own ids.
    return await fetchAuditEntryMock(entryId, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "That audit entry could not be loaded.");
  }
}

export async function fetchAuditAdmins(signal?: AbortSignal): Promise<readonly AuditAdmin[]> {
  try {
    // 2026-07-23: `GET /ops/audit/admins` still answers 501 — same note as above; flip to
    // `opsListAuditAdmins` when it lands. Until then the filter dropdown lists the mock admins.
    return await fetchAuditAdminsMock(signal);
  } catch (thrown) {
    throw normalizeError(thrown, "The admin filter could not be loaded.");
  }
}
