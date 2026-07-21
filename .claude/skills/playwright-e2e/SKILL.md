---
name: playwright-e2e
description: Structure and write Playwright E2E tests for the SETHU-CARE frontend SPAs (customer/provider/admin) — Page Object Model, resilient locators, web-first assertions, OTP dev-login auth state. Use when adding or editing E2E specs, page objects, fixtures, or playwright.config.ts.
---

# Playwright E2E Testing — SETHU-CARE

E2E tests live **per app** (each SPA is an independent product surface):

```
frontend/apps/<app>/
├── playwright.config.ts          # single config at the app root
└── e2e/
    ├── global-setup.ts           # dev-OTP login once → storageState
    ├── .auth/storageState.json   # gitignored
    ├── fixtures.ts               # optional: inject page objects as params
    ├── pages/                    # Page Object Model classes (one per screen/flow)
    │   └── BookingsPage.ts
    └── bookings/                 # feature-based spec folders
        └── bookings.spec.ts
```

## Rules

1. **Page Object Model.** One class per screen/flow: `readonly page: Page`, locators as
   `readonly` properties, methods for actions (`goto()`, `submitOtp(code)`) and
   assertions (`expectCountdownVisible()`). Composition over inheritance.
2. **Resilient locators only.** `getByRole` / `getByLabel` / `getByText` — never CSS
   selectors or XPath. Because all UI text is localized (`@sethu/i18n`), tests run with
   the **en** locale and match accessible names from `locales/en/`; if a target has no
   accessible name, fix the component's semantics first (a11y win) rather than adding a
   test id.
3. **Web-first assertions.** `await expect(locator).toBeVisible()` — never manual
   waits/sleeps or `isVisible()` polling.
4. **Auth via storage state.** `global-setup.ts` performs the dev OTP login once
   (backend with `SETHU_DEV_OTP=true`; demo phone from AGENTS.md; `POST /auth/otp`
   returns `dev_code`) and saves `storageState`; specs reuse it. Never log in per test.
5. **Test against the built app** (`vite preview`) via `webServer` in the config, with
   `VITE_API_URL` pointed at the local backend (`:8090`). Capacitor-WebView E2E is a
   separate, later concern — these tests cover the web surface.
6. **Spec hygiene:** feature-named folders; one behaviour per test; no test depends on
   another's side effects; seeded/demo data only — specs never mutate live data.
7. **Never modify existing test files** while changing product code unless the task is
   explicitly about those tests — a failing test is signal, not friction.

## Canonical shapes

```ts
// e2e/pages/BookingsPage.ts
import { expect, type Locator, type Page } from "@playwright/test";

export class BookingsPage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Bookings" });
  }

  async goto() {
    await this.page.goto("/bookings");
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }
}
```

```ts
// e2e/bookings/bookings.spec.ts
import { test } from "@playwright/test";
import { BookingsPage } from "../pages/BookingsPage";

test("bookings list loads for an authed customer", async ({ page }) => {
  const bookingsPage = new BookingsPage(page);
  await bookingsPage.goto();
  await bookingsPage.expectLoaded();
});
```

Add `e2e/.auth/` to the app's `.gitignore` when creating the suite. Wire an `e2e` script
+ turbo task in the same PR that introduces the first spec.
