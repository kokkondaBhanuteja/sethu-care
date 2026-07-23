import { shellCounters } from "@sethu/api-client";
import type { ShellCounters as ApiShellCounters } from "@sethu/api-client";

import { env } from "../lib/env";
import { normalizeError } from "../lib/http/apiError";
import { fetchShellCountersMock } from "./shell.mock";
import type { ShellCounters } from "./shell.types";

// The one boundary between the shells and their data.
//
// `GET /ops/shell-counters` is real (backend commit 6543b30): with mocks off the generated
// client serves the badge counts; with mocks on the mock still does, so unit tests and e2e runs
// are unchanged. That replaceability is the whole reason components never import a mock directly.

/** Field-for-field: `queries/shell.types.ts` is the normative shape, so drift is a compile error. */
export function mapShellCounters(payload: ApiShellCounters): ShellCounters {
  return {
    criticalAlerts: payload.criticalAlerts,
    needsAttention: payload.needsAttention,
    pendingApplications: payload.pendingApplications,
    openTickets: payload.openTickets,
  };
}

export async function fetchShellCounters(signal?: AbortSignal): Promise<ShellCounters> {
  try {
    if (env.useMocks) return await fetchShellCountersMock(signal);

    const result = await shellCounters({ signal });
    if (result.data === undefined) throw result.response;
    return mapShellCounters(result.data);
  } catch (thrown) {
    throw normalizeError(thrown, "Navigation counters could not be loaded.");
  }
}
