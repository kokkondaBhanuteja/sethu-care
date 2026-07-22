import { DEFAULT_ROUTE } from "../../src/routes/routes.constants";
import { expect, test } from "../fixtures";
import { MOCK_LOGIN } from "../support/mockTriggers";

/**
 * The auth specs are the only ones that do NOT carry the shared storage state — they are about
 * signing in. See the `auth` project in playwright.config.ts.
 */

test("an admin signs in with email, password and the second factor", async ({
  page,
  signIn,
  twoFactor,
}) => {
  await signIn.goto();
  await signIn.expectLoaded();

  await signIn.signIn(MOCK_LOGIN.email, MOCK_LOGIN.password);

  await twoFactor.expectLoaded();
  await twoFactor.typeCode(MOCK_LOGIN.code);

  await expect(page).toHaveURL(new RegExp(`${DEFAULT_ROUTE}$`));
});

test("the dashboard is reachable once the session exists", async ({
  page,
  shell,
  signIn,
  twoFactor,
}) => {
  await signIn.goto();
  await signIn.signIn(MOCK_LOGIN.email, MOCK_LOGIN.password);
  await twoFactor.typeCode(MOCK_LOGIN.code);

  await expect(page.getByRole("heading", { name: "Live", level: 1 })).toBeVisible();
  await shell.expectNoErrorBoundary();
});
