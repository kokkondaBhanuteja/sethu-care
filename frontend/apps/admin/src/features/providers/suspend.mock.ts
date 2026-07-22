// Step 3's data and the write side of the suspend / block / force-offline flow (spec §6.19).
//
// Active jobs are the reason step 3 exists: the design's provider is mid-shift with two live
// bookings, and the flow refuses to continue until both have an answer.

import { mockRead, mockWrite } from "../../mocks/mockTransport";
import { ACTIVE_JOB_STAGES, SUSPEND_ACTION_TYPES } from "./suspend.types";
import type {
  ProviderActiveJob,
  SuspendProviderInput,
  SuspendProviderResult,
} from "./suspend.types";
import { PROVIDER_IDS } from "./providerFixtures";

const RUPEE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Providers with no live work at all — suspending them skips straight past step 3. */
const IDLE_PROVIDER_IDS: readonly string[] = [
  PROVIDER_IDS.suspended,
  PROVIDER_IDS.offboarded,
  PROVIDER_IDS.expiredDocuments,
];

const ACTIVE_JOBS: readonly ProviderActiveJob[] = [
  {
    bookingId: "#B-8817",
    stage: ACTIVE_JOB_STAGES.enRoute,
    service: "Plumbing",
    customerName: "Anita Sharma",
    zone: "Gachibowli",
    amountPaise: 899 * RUPEE,
    etaMinutes: 8,
    suggestedProviderName: "Kiran Rao",
  },
  {
    bookingId: "#B-8809",
    stage: ACTIVE_JOB_STAGES.inProgress,
    service: "Electrical",
    customerName: "Meena Reddy",
    zone: "Miyapur",
    amountPaise: 1200 * RUPEE,
    startedAt: "2026-07-22T09:34:00Z",
    suggestedProviderName: "Farhan Ali",
  },
];

export function fetchProviderActiveJobsMock(
  providerId: string,
  signal?: AbortSignal,
): Promise<readonly ProviderActiveJob[]> {
  return mockRead<readonly ProviderActiveJob[]>(
    () => (IDLE_PROVIDER_IDS.includes(providerId) ? [] : ACTIVE_JOBS),
    { ...(signal ? { signal } : {}), emptyValue: [] },
  );
}

export function suspendProviderMock(
  input: SuspendProviderInput,
  signal?: AbortSignal,
): Promise<SuspendProviderResult> {
  return mockWrite<SuspendProviderResult>(
    () => ({
      providerId: input.providerId,
      type: input.type,
      durationDays: input.durationDays,
      effectiveUntil:
        input.type === SUSPEND_ACTION_TYPES.suspend && input.durationDays !== null
          ? new Date(Date.now() + input.durationDays * DAY_MS).toISOString()
          : null,
    }),
    { ...(signal ? { signal } : {}) },
  );
}

export function restoreProviderMock(
  providerId: string,
  signal?: AbortSignal,
): Promise<{ providerId: string }> {
  return mockWrite(() => ({ providerId }), { ...(signal ? { signal } : {}) });
}
