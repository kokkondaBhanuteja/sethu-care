import { expect, test } from "../fixtures";
import { AUTH_TRIGGERS, MOCK_LOGIN } from "../support/mockTriggers";

/**
 * The designed refusals. None of these is a client-side security control — attempt counting,
 * lockout and the trusted-device cap are server-enforced (spec §5.8); these screens render the
 * server's answers, and two of them carry a payload the UI must show.
 */

test("a wrong password is refused without naming which field was wrong", async ({ signIn }) => {
  await signIn.goto();
  await signIn.signIn(MOCK_LOGIN.email, AUTH_TRIGGERS.wrongPassword);

  await signIn.expectAlert("Email or password is incorrect");
});

test("a locked account shows the cool-off countdown and makes the form inert", async ({
  signIn,
}) => {
  await signIn.goto();
  await signIn.signIn(AUTH_TRIGGERS.lockedEmail, MOCK_LOGIN.password);

  // Amber, not red: the account is fine, it is only waiting.
  await signIn.expectAlert(/Too many attempts\. Try again in \d+:\d{2}/);
  await signIn.expectFormInert();
  // The reset link is the one thing a locked-out admin can still use.
  await expect(signIn.forgotPassword).toBeVisible();
});

test("a disabled account is refused with the escalation path in the copy", async ({ signIn }) => {
  await signIn.goto();
  await signIn.signIn(AUTH_TRIGGERS.disabledEmail, MOCK_LOGIN.password);

  await signIn.expectAlert("This account has been disabled. Contact your Super Admin.");
});

test("a wrong code clears the cells and counts the attempt down", async ({ signIn, twoFactor }) => {
  await signIn.goto();
  await signIn.signIn(MOCK_LOGIN.email, MOCK_LOGIN.password);
  await twoFactor.expectLoaded();

  await twoFactor.typeCode(AUTH_TRIGGERS.wrongCode);

  await expect(twoFactor.alert).toHaveText(/That code isn't right\. \d+ attempts? left\./);
  // A half-corrected code is the most common way to burn an attempt (BOX 56).
  await twoFactor.expectCleared();
});

test("an expired code offers a resend rather than a dead Verify button", async ({
  signIn,
  twoFactor,
}) => {
  await signIn.goto();
  await signIn.signIn(MOCK_LOGIN.email, MOCK_LOGIN.password);
  await twoFactor.expectLoaded();

  await twoFactor.typeCode(AUTH_TRIGGERS.expiredCode);

  await expect(twoFactor.alert).toHaveText("This code expired.");
  await expect(twoFactor.page.getByRole("button", { name: "Resend code" })).toBeEnabled();
});

test("the trusted-device cap offers a device to revoke instead of a dead end", async ({
  signIn,
  twoFactor,
}) => {
  await signIn.goto();
  await signIn.signIn(MOCK_LOGIN.email, MOCK_LOGIN.password);
  await twoFactor.expectLoaded();

  await twoFactor.typeCode(AUTH_TRIGGERS.deviceLimitCode);

  await expect(twoFactor.deviceLimitHeading).toBeVisible();
  await expect(twoFactor.page.getByRole("button", { name: "Revoke" }).first()).toBeEnabled();
});
