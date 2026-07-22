// Shared plumbing for the mock services that stand in for the ~90% of this console's endpoints the
// backend does not expose yet (see docs/admin-api-contract.md).
//
// Every mock read goes through `mockRead`, which honours VITE_MOCK_MODE. That is what makes each
// §4.10 state reachable in dev without a backend: flip the mode and every screen shows its empty,
// error or skeleton path. Screens never know — they call their feature's .api.ts, which chooses.

import { env, MOCK_MODES } from "../lib/env";
import { API_ERROR_CODES, apiError } from "../lib/http/apiError";

/** Fast enough to feel local, slow enough that a skeleton actually renders. */
const NORMAL_LATENCY_MS = 220;
const SLOW_LATENCY_MS = 3_000;

function latency(): number {
  return env.mockMode === MOCK_MODES.slow ? SLOW_LATENCY_MS : NORMAL_LATENCY_MS;
}

function sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export interface MockReadOptions<TData> {
  /** Cancellation, forwarded from TanStack Query so an abandoned screen stops its work. */
  signal?: AbortSignal;
  /** What "empty" looks like for this endpoint, used when VITE_MOCK_MODE=empty. */
  emptyValue?: TData;
}

/** Resolve mock data with realistic latency, honouring the forced error/empty/slow modes. */
export async function mockRead<TData>(
  produce: () => TData,
  options: MockReadOptions<TData> = {},
): Promise<TData> {
  await sleep(latency(), options.signal);

  if (env.mockMode === MOCK_MODES.error) {
    throw apiError(
      API_ERROR_CODES.server,
      "The mock service was told to fail (VITE_MOCK_MODE=error).",
      {
        status: 500,
      },
    );
  }

  if (env.mockMode === MOCK_MODES.empty && options.emptyValue !== undefined) {
    return options.emptyValue;
  }

  return produce();
}

/**
 * Mutations are never subject to the forced-error mode: a screen exercising its empty state should
 * still be able to act. Failure paths are driven by the mock's own rules instead (a goodwill cap
 * exceeded, a booking already changed), which is what the design's failure states actually depict.
 */
export async function mockWrite<TResult>(
  produce: () => TResult,
  options: { signal?: AbortSignal } = {},
): Promise<TResult> {
  await sleep(latency(), options.signal);
  return produce();
}
