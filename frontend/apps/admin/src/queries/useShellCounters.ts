import { useQuery } from "@tanstack/react-query";

import { fetchShellCounters } from "./shell.api";
import type { ShellCounters } from "./shell.types";

export const SHELL_QUERY_KEYS = {
  counters: ["shell", "counters"] as const,
};

/** Badge counts refresh often — a stale critical count is the one number that must not be wrong. */
const REFETCH_INTERVAL_MS = 30_000;

const ZERO_COUNTERS: ShellCounters = {
  criticalAlerts: 0,
  needsAttention: 0,
  pendingApplications: 0,
  openTickets: 0,
};

/**
 * Drives every navigation badge in both shells. Failure is deliberately silent: a badge that cannot
 * load renders as zero rather than pushing an error state into the chrome, because the shell must
 * stay usable so the operator can navigate to the thing that is broken.
 */
export function useShellCounters(): ShellCounters {
  const query = useQuery({
    queryKey: SHELL_QUERY_KEYS.counters,
    queryFn: ({ signal }) => fetchShellCounters(signal),
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  return query.data ?? ZERO_COUNTERS;
}
