import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { chromium, type FullConfig } from "@playwright/test";

import { E2E_ORIGINS, STORAGE_STATE, type MockMode } from "./support/env";
import { MOCK_LOGIN } from "./support/mockTriggers";

/**
 * Sign in ONCE and save the session, so no spec logs in except the auth specs, which are about
 * logging in.
 *
 * DEVIATION from `.claude/skills/playwright-e2e/SKILL.md` rule 4: the skill describes a dev-OTP
 * login against a live Go backend. The admin console has no backend — only six `/ops/*` endpoints
 * exist and the console runs on `VITE_USE_MOCKS=true`, which is the default. This login is
 * therefore the MOCKED one documented in `src/features/auth/CLAUDE.md`: any plausible email, any
 * password of 8+ characters, then any six digits. See the header of `playwright.config.ts`.
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${E2E_ORIGINS.normal}/login`);
    await page.getByLabel("Email").fill(MOCK_LOGIN.email);
    await page.getByLabel("Password", { exact: true }).fill(MOCK_LOGIN.password);
    await page.getByRole("button", { name: "Continue" }).click();

    await page.waitForURL("**/login/otp");
    // Typing into the first cell and letting auto-advance carry the rest is exactly how an operator
    // enters the code — and the path that once swallowed every second digit.
    await page
      .getByRole("textbox", { name: /verification code/ })
      .first()
      .focus();
    await page.keyboard.type(MOCK_LOGIN.code);
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    const state = await context.storageState();

    // localStorage is origin-scoped and the three mock modes are three separate builds on three
    // ports, so the one session is written once per origin rather than logged in three times.
    for (const mode of Object.keys(E2E_ORIGINS) as MockMode[]) {
      writeState(STORAGE_STATE[mode], {
        ...state,
        origins: state.origins.map((origin) => ({ ...origin, origin: E2E_ORIGINS[mode] })),
      });
    }
  } finally {
    await browser.close();
  }
}

function writeState(file: string, state: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(state, null, 2), "utf8");
}
