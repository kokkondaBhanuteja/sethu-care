import { ROUTES } from "../../src/routes/routes.constants";
import { expect, test } from "../fixtures";
import { ERROR_STATE_TIMEOUT_MS } from "../support/env";

/**
 * `VITE_MOCK_MODE=error` — every mock read rejects. Runs against its own build on its own port
 * (see the `states-error` project); Vite inlines VITE_* at build time, so the mode cannot be
 * switched on a running preview.
 *
 * The failure this guards against is a blank page or a crash where §4.10's error + retry belongs.
 */

const LIST_SCREENS = [
  { name: "bookings", url: ROUTES.bookings },
  { name: "providers", url: ROUTES.providers },
  { name: "applications", url: ROUTES.applications },
  { name: "alerts", url: ROUTES.alerts },
  { name: "audit log", url: ROUTES.audit },
  { name: "live dashboard", url: ROUTES.live },
  { name: "needs attention", url: ROUTES.liveAttention },
];

for (const screen of LIST_SCREENS) {
  test(`the ${screen.name} screen fails into error + retry`, async ({ listScreen, shell }) => {
    await listScreen.goto(screen.url);

    await listScreen.expectErrorAndRetry();
    await shell.expectNoErrorBoundary();
  });
}

test("the failure explains itself rather than showing a bare code", async ({ page }) => {
  await page.goto(ROUTES.bookings);

  await expect(page.getByRole("heading", { name: "Something went wrong" }).first()).toBeVisible({
    timeout: ERROR_STATE_TIMEOUT_MS,
  });
  await expect(page.getByText(/mock service was told to fail/).first()).toBeVisible();
});

test("the shell survives the failure so the operator can navigate away", async ({
  page,
  shell,
  listScreen,
}) => {
  await listScreen.goto(ROUTES.bookings);
  await listScreen.expectErrorAndRetry();

  await expect(shell.sidebarNav).toBeVisible();
  await shell.sidebarLink("Providers").click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.providers}$`));
});
