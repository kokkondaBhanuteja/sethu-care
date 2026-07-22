import { mockRead } from "../mocks/mockTransport";
import type { ShellCounters } from "./shell.types";

/**
 * Matches the counts the approved designs render: 7 needing attention, 2 unacknowledged criticals,
 * 4 open tickets. Keeping the fixtures identical to the artifacts is what lets a screen be compared
 * against its design tile directly.
 */
const COUNTERS: ShellCounters = {
  criticalAlerts: 2,
  needsAttention: 7,
  pendingApplications: 3,
  openTickets: 4,
};

const EMPTY: ShellCounters = {
  criticalAlerts: 0,
  needsAttention: 0,
  pendingApplications: 0,
  openTickets: 0,
};

export function fetchShellCountersMock(signal?: AbortSignal): Promise<ShellCounters> {
  return mockRead(() => COUNTERS, { ...(signal ? { signal } : {}), emptyValue: EMPTY });
}
