import { expect, test } from "../fixtures";
import { ALL_ROUTES, expectationFor } from "../support/routeExpectations";

/**
 * Every route in `src/routes/routes.constants.ts`, driven from the app's OWN route table.
 *
 * Nothing here lists routes by hand: the loop is over `ROUTE_TABLE`, and `expectationFor` throws
 * for any pattern with no entry in `support/routeExpectations.ts`. Adding a route to the app
 * without adding its expectation therefore fails this file — a new destination cannot ship
 * untested, which is the whole point of driving it from the table.
 */

test("the route table and the expectation table agree", () => {
  expect(() => ALL_ROUTES.map(expectationFor)).not.toThrow();
});

for (const route of ALL_ROUTES) {
  const expectation = expectationFor(route);

  test(`${route.pattern} loads and names itself`, async ({ page, shell }) => {
    // Routes with a known defect stay failing on purpose — see the `defect` note in the
    // expectation. Do not weaken the assertion to make the suite green.
    if (expectation.defect) test.fail(true, expectation.defect);

    await page.goto(expectation.url);

    if (expectation.redirectsTo) {
      await expect(page).toHaveURL(new RegExp(`${expectation.redirectsTo}$`));
    }

    // Exact, because several routes carry both a topbar title and a state heading that begins with
    // it ("Pricing rules" above "Pricing rules — Coming in v1.1"), and a substring match would be
    // satisfied by either.
    const heading = expectation.asDialog
      ? page.getByRole("dialog", { name: expectation.heading, exact: true })
      : page.getByRole("heading", { name: expectation.heading, exact: true });

    // `.first()` for one route only: the provider profile renders its own <h1> as well as the
    // shell's, so that page has two identical headings. See the report — the page-level one should
    // become an <h2>.
    await expect(heading.first()).toBeVisible();
    await shell.expectNoErrorBoundary();
  });
}
