/**
 * The three servers the suite drives, and the storage state each one gets.
 *
 * `VITE_*` variables are inlined by Vite at BUILD time, so `VITE_MOCK_MODE` cannot be changed by
 * setting an environment variable on `vite preview` — each mock mode needs its own bundle. The
 * config therefore builds three times into `dist-e2e/<mode>` and previews each on its own port.
 *
 * Because localStorage is origin-scoped, one signed-in storage state cannot serve three ports;
 * `global-setup.ts` signs in once and writes the same session under each origin.
 */

const HOST = "http://127.0.0.1";

export const E2E_PORTS = {
  normal: 4300,
  error: 4301,
  empty: 4302,
} as const;

export type MockMode = keyof typeof E2E_PORTS;

export const E2E_ORIGINS = {
  normal: `${HOST}:${E2E_PORTS.normal}`,
  error: `${HOST}:${E2E_PORTS.error}`,
  empty: `${HOST}:${E2E_PORTS.empty}`,
} as const satisfies Record<MockMode, string>;

export const STORAGE_STATE = {
  normal: "./e2e/.auth/storageState.json",
  error: "./e2e/.auth/storageState.error.json",
  empty: "./e2e/.auth/storageState.empty.json",
} as const satisfies Record<MockMode, string>;

/** The 768px shell split (`hooks/useBreakpoint.ts`). At exactly 768 the DESKTOP shell renders. */
export const SHELL_BREAKPOINT_PX = 768;

/**
 * `VITE_MOCK_MODE=error` makes every read reject, and the query client retries twice with backoff
 * before the error state can appear. Five seconds is not enough to see it.
 */
export const ERROR_STATE_TIMEOUT_MS = 20_000;
