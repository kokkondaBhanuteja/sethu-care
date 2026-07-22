import { defineConfig, devices } from "@playwright/test";

import { E2E_ORIGINS, E2E_PORTS, SHELL_BREAKPOINT_PX, STORAGE_STATE } from "./e2e/support/env";

/**
 * ───────────────────────────────────────────────────────────────────────────────────────────────
 * DELIBERATE DEVIATION FROM `.claude/skills/playwright-e2e/SKILL.md` — DO NOT "FIX" THIS BACK.
 *
 * The skill's rules 4 and 5 describe a dev-OTP login against the local Go API with
 * `VITE_API_URL=http://localhost:8090`. THE ADMIN CONSOLE HAS NO BACKEND. Only six `/ops/*`
 * endpoints exist (`docs/admin-api-contract.md` is the backend's work list); everything else is
 * served by the typed mock services, and `VITE_USE_MOCKS` defaults to true. Pointing this suite at
 * a Go backend would make every screen fail with a 501.
 *
 * So:
 *  - `webServer` previews the BUILT app with mocks on. No `VITE_API_URL`, no backend process.
 *  - `global-setup.ts` performs the MOCKED login documented in `src/features/auth/CLAUDE.md`:
 *    any plausible email, any password of 8+ characters, then any six digits. It saves
 *    `storageState`, which every project except `auth` reuses.
 *  - `VITE_*` variables are inlined by Vite at BUILD time, so `VITE_MOCK_MODE` cannot be flipped on
 *    `vite preview`. Each mock mode is its own bundle in `dist-e2e/<mode>` on its own port, and the
 *    `states-*` projects point at those origins.
 * ───────────────────────────────────────────────────────────────────────────────────────────────
 */

const DESKTOP = { width: 1440, height: 900 } as const;

/** Every mock mode gets a build + a preview. `vite build` deletes its own outDir, so they nest. */
function server(mode: "normal" | "error" | "empty", port: number) {
  const outDir = `dist-e2e/${mode}`;
  return {
    command:
      `pnpm exec vite build --outDir ${outDir} && ` +
      // `--host 127.0.0.1` on purpose: vite preview's default `localhost` resolves to ::1 first on
      // Windows, and Playwright's readiness probe then never sees the server come up.
      `pnpm exec vite preview --outDir ${outDir} --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/login`,
    env: { VITE_USE_MOCKS: "true", VITE_MOCK_MODE: mode },
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: "ignore" as const,
  };
}

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: E2E_ORIGINS.normal,
    // Every spec matches accessible names from `packages/i18n/locales/en/features/admin-*.json`.
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      // The one area that must NOT carry the shared session: these specs are about signing in.
      name: "auth",
      testMatch: /auth\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: DESKTOP },
    },
    {
      name: "console",
      testMatch: /(shell|bookings|providers|a11y)\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: DESKTOP,
        storageState: STORAGE_STATE.normal,
      },
    },
    {
      name: "states-error",
      testMatch: /states\/error-states\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: DESKTOP,
        baseURL: E2E_ORIGINS.error,
        storageState: STORAGE_STATE.error,
      },
    },
    {
      name: "states-empty",
      testMatch: /states\/empty-states\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: DESKTOP,
        baseURL: E2E_ORIGINS.empty,
        storageState: STORAGE_STATE.empty,
      },
    },
    // The four widths the design is drawn at: the phone artboard, the shell split itself, a small
    // laptop and the desktop artboard. 768 is included because it is the boundary — at exactly
    // 768px `useIsDesktop()` is true, so the sidebar renders and the tab bar does not.
    ...([390, SHELL_BREAKPOINT_PX, 1024, 1440] as const).map((width) => ({
      name: `responsive-${width}`,
      testMatch: /responsive\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width, height: 900 },
        storageState: STORAGE_STATE.normal,
      },
    })),
  ],

  webServer: [
    server("normal", E2E_PORTS.normal),
    server("error", E2E_PORTS.error),
    server("empty", E2E_PORTS.empty),
  ],
});
