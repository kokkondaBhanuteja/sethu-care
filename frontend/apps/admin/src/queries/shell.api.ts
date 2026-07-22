import { normalizeError } from "../lib/http/apiError";
import { fetchShellCountersMock } from "./shell.mock";
import type { ShellCounters } from "./shell.types";

// The one boundary between the shells and their data.
//
// There is no backend endpoint for these counters yet — see docs/admin-api-contract.md,
// `GET /ops/shell-counters`. When it lands, the generated client's call replaces the mock call
// below and nothing above this file changes. That replaceability is the whole reason components
// never import a mock directly.

export async function fetchShellCounters(signal?: AbortSignal): Promise<ShellCounters> {
  try {
    return await fetchShellCountersMock(signal);
  } catch (thrown) {
    throw normalizeError(thrown, "Navigation counters could not be loaded.");
  }
}
