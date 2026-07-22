import { readCounters, ZERO_COUNTERS } from "../mocks/counterStore";
import { mockRead } from "../mocks/mockTransport";
import type { ShellCounters } from "./shell.types";

/**
 * Counters come from the shared mock store rather than a frozen literal, so acknowledging the last
 * critical alert actually drops the badge to zero. A badge that never moves reads as broken even
 * when the invalidation behind it is correct.
 */
export function fetchShellCountersMock(signal?: AbortSignal): Promise<ShellCounters> {
  return mockRead(readCounters, {
    ...(signal ? { signal } : {}),
    emptyValue: ZERO_COUNTERS,
  });
}
