// The single place `import.meta.env` is read. Everything else imports `env` from here, so a
// missing or renamed variable is one compile error rather than a runtime surprise on a screen.

/** Deterministic mock behaviours, so every §4.10 screen state is reachable in dev without a backend. */
export const MOCK_MODES = {
  normal: "normal",
  /** Every mock read rejects — exercises the error + retry state. */
  error: "error",
  /** Every mock read resolves to zero rows — exercises the empty state. */
  empty: "empty",
  /** Mock reads take 3s — exercises skeletons and in-flight affordances. */
  slow: "slow",
} as const;

export type MockMode = (typeof MOCK_MODES)[keyof typeof MOCK_MODES];

function readMockMode(raw: string | undefined): MockMode {
  const candidate = raw ?? MOCK_MODES.normal;
  return isMockMode(candidate) ? candidate : MOCK_MODES.normal;
}

function isMockMode(value: string): value is MockMode {
  return Object.values(MOCK_MODES).includes(value as MockMode);
}

/**
 * The build stamp the sidebar and the Help screen show. Version and build number come from the
 * package at build time; the environment label is derived rather than configured, so a production
 * bundle can never be mislabelled by a forgotten variable.
 */
export const APP_BUILD = {
  version: __APP_VERSION__,
  label: import.meta.env.DEV
    ? `v${__APP_VERSION__} · Development`
    : `v${__APP_VERSION__} · Production`,
} as const;

export const env = {
  /** Local Go API default matches backend/.env.example's ADDR=:8090. */
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8090",
  /** Mocks are the default: only six of this console's endpoints exist on the backend today. */
  useMocks: (import.meta.env.VITE_USE_MOCKS ?? "true") === "true",
  mockMode: readMockMode(import.meta.env.VITE_MOCK_MODE),
  isDev: import.meta.env.DEV,
} as const;
