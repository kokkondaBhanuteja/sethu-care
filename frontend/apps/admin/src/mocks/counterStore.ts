import type { ShellCounters } from "../queries/shell.types";

// Shared mutable state for the mock services.
//
// Without this, the shell badges are a constant: acknowledging the last critical alert correctly
// invalidates the counters query, the mock re-answers the same number, and the badge never drops —
// which makes the badge look broken during review even though the wiring is right.
//
// It exists only because the backend has no `/ops/shell-counters` endpoint yet. When that lands,
// this file and its callers go away together; nothing above a feature's `.api.ts` knows it exists.

const INITIAL: ShellCounters = {
  // Matches the approved designs: 2 unacknowledged criticals, 7 needing attention, 4 open tickets.
  criticalAlerts: 2,
  needsAttention: 7,
  pendingApplications: 3,
  openTickets: 4,
};

let counters: ShellCounters = { ...INITIAL };

export function readCounters(): ShellCounters {
  return counters;
}

/** Apply a signed delta to one counter, clamped at zero. Mock services call this after a write. */
export function adjustCounter(key: keyof ShellCounters, delta: number): void {
  counters = { ...counters, [key]: Math.max(0, counters[key] + delta) };
}

/** Reset to the designed starting state — used by the `empty` mock mode and by tests. */
export function resetCounters(): void {
  counters = { ...INITIAL };
}

export const ZERO_COUNTERS: ShellCounters = {
  criticalAlerts: 0,
  needsAttention: 0,
  pendingApplications: 0,
  openTickets: 0,
};
