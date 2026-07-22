import { expect, test } from "../fixtures";

/**
 * Spec §10.1: no self-signup, ever. Admin accounts are provisioned by a Super Admin in the web
 * dashboard. The provisioning note under the form is the deliberate replacement for the link a
 * consumer app would put there, and password reset leaves the app entirely.
 *
 * This is a security property, not a copy preference — an admin console that can mint its own
 * accounts is a different product.
 */

const SIGNUP_AFFORDANCES = [
  /create account/i,
  /sign up/i,
  /register/i,
  /new account/i,
  /continue with google/i,
  /continue with apple/i,
];

test.beforeEach(async ({ signIn }) => {
  await signIn.goto();
  await signIn.expectLoaded();
});

test("the login screen offers no way to create an account", async ({ page }) => {
  for (const affordance of SIGNUP_AFFORDANCES) {
    await expect(page.getByRole("button", { name: affordance })).toHaveCount(0);
    await expect(page.getByRole("link", { name: affordance })).toHaveCount(0);
  }
});

test("the provisioning note stands in for the missing sign-up link", async ({ signIn }) => {
  await expect(signIn.provisioningNote).toBeVisible();
});

test("password reset leaves the app rather than completing in it", async ({ signIn }) => {
  await expect(signIn.forgotPassword).toHaveAttribute(
    "href",
    "https://admin.setucare.in/forgot-password",
  );
  await expect(signIn.forgotPassword).toHaveAttribute("target", "_blank");
});
