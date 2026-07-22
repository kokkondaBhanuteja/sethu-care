import { ROUTES, ROUTE_TABLE, SURFACES } from "../../src/routes/routes.constants";
import { expect, test } from "../fixtures";

/**
 * Spec §6.34: `desktopOnly` is a PRODUCT decision — payouts, settlement cycles and ledger work are
 * batch processes, not phone work — and a deep link to one from a phone must never produce a blank
 * screen, a 404 or a broken layout. It shows what it can, explains why, and offers a way forward.
 * That distinction is what separates a scope decision from a bug.
 */

const DESKTOP_ONLY = ROUTE_TABLE.filter((route) => route.surface === SURFACES.desktopOnly);

test.use({ viewport: { width: 390, height: 844 } });

test("there are desktop-only routes to guard", () => {
  expect(DESKTOP_ONLY.length).toBeGreaterThan(0);
});

for (const route of DESKTOP_ONLY) {
  test(`${route.pattern} explains itself at a phone width`, async ({ page, shell }) => {
    await page.goto(route.pattern);

    await expect(page.getByRole("heading", { name: "Best on desktop" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await shell.expectNoErrorBoundary();
  });
}

test("the notice names the destination rather than saying 'this page'", async ({ page }) => {
  await page.goto(ROUTES.payouts);

  await expect(
    page.getByText(/Payouts & settlements — Finance and configuration work needs a full screen/),
  ).toBeVisible();
});

test("a desktop-only route with a read-only summary still shows it", async ({ page }) => {
  await page.goto(ROUTES.payouts);

  // "Shows what it can": the payouts cycle figures render above the notice.
  await expect(
    page.getByText("Read-only. Payout runs cannot be executed from mobile."),
  ).toBeVisible();
});

test("the same route renders its own screen above the breakpoint", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(ROUTES.payouts);

  await expect(page.getByRole("heading", { name: "Payouts & settlements" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Best on desktop" })).toBeHidden();
});
