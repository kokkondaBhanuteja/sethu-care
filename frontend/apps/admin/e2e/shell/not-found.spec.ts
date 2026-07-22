import { ROUTES } from "../../src/routes/routes.constants";
import { expect, test } from "../fixtures";
import { ALERT_TRIGGERS, BOOKING_TRIGGERS, PROVIDER_TRIGGERS } from "../support/mockTriggers";

/**
 * Spec §3.4 rule 3. These URLs arrive from push notifications and pasted links, so an id that no
 * longer resolves has to land on the not-found state with a way back — never a crash, never a
 * blank screen, never a redirect that hides what happened.
 */

const UNKNOWN_RECORDS = [
  { name: "booking", url: ROUTES.bookingDetail(BOOKING_TRIGGERS.unknown) },
  { name: "provider", url: ROUTES.providerDetail(PROVIDER_TRIGGERS.unknown) },
  { name: "alert", url: ROUTES.alertDetail(ALERT_TRIGGERS.unknown) },
];

for (const record of UNKNOWN_RECORDS) {
  test(`an unknown ${record.name} id renders the not-found state`, async ({ page, shell }) => {
    await page.goto(record.url);

    await expect(page.getByRole("heading", { name: /no longer exists/i })).toBeVisible();
    await shell.expectNoErrorBoundary();
  });

  test(`the not-found ${record.name} offers a route back`, async ({ page }) => {
    await page.goto(record.url);

    const wayBack = page
      .getByRole("link", { name: /^Back to/ })
      .or(page.getByRole("button", { name: /^Back to/ }));
    await expect(wayBack.first()).toBeVisible();
  });
}

test("an unrecognised path falls back to the dashboard rather than a dead route", async ({
  page,
  shell,
}) => {
  await page.goto("/this-route-does-not-exist");

  await expect(page).toHaveURL(new RegExp(`${ROUTES.live}$`));
  await shell.expectNoErrorBoundary();
});
