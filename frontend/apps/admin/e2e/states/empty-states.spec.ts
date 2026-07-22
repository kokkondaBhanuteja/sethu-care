import { ROUTES } from "../../src/routes/routes.constants";
import { expect, test } from "../fixtures";

/**
 * `VITE_MOCK_MODE=empty` — every mock read returns zero rows. Runs against its own build on its own
 * port (the `states-empty` project).
 *
 * Every empty state has to say why there is nothing here, never just "No data" (spec §4.10), and
 * the alerts feed's empty is deliberately positive: an empty alerts feed is good news.
 */

const EMPTY_SCREENS = [
  { url: ROUTES.bookings, title: "No active bookings" },
  { url: ROUTES.providers, title: "No providers in this segment" },
  { url: ROUTES.applications, title: "No applications waiting" },
  { url: ROUTES.alerts, title: "You're all caught up" },
  { url: ROUTES.audit, title: "No audit entries yet" },
];

for (const screen of EMPTY_SCREENS) {
  test(`${screen.url} renders its empty state`, async ({ listScreen, shell }) => {
    await listScreen.goto(screen.url);

    await listScreen.expectEmptyState(screen.title);
    await shell.expectNoErrorBoundary();
  });
}

test("an empty state explains why, rather than only stating the absence", async ({ page }) => {
  await page.goto(ROUTES.bookings);

  await expect(
    page.getByText("Every job on the board is either finished or cancelled right now."),
  ).toBeVisible();
});

test("the empty alerts feed reads as relief rather than absence", async ({ page }) => {
  await page.goto(ROUTES.alerts);

  await expect(page.getByRole("heading", { name: "You're all caught up" })).toBeVisible();
  await expect(
    page.getByText("No alert is waiting on a decision. Anything below is for information only."),
  ).toBeVisible();
});

test("empty is not error: no retry is offered where nothing failed", async ({ page }) => {
  await page.goto(ROUTES.providers);

  await expect(page.getByRole("heading", { name: "No providers in this segment" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
});
