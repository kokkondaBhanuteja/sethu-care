import { BOOKING_TRIGGERS, MOCK_LOGIN } from "../support/mockTriggers";
import { DEFAULT_ROUTE, ROUTES } from "../../src/routes/routes.constants";
import { expect, test } from "../fixtures";

/**
 * Spec §3.4 rule 1, and the regression this suite exists to prevent.
 *
 * An admin opens the app because of a push about a booking that is on fire. `RequireAuth` captures
 * the attempted location, `authRouterState` carries it through login → two-factor, and `resumePath`
 * returns it. Landing on the dashboard instead discards the entire reason the app was opened.
 */

const CANCEL_URL = ROUTES.bookingCancel(BOOKING_TRIGGERS.ordinary);

test("a signed-out deep link is captured rather than dropped", async ({ page, signIn }) => {
  await page.goto(CANCEL_URL);

  await expect(page).toHaveURL(new RegExp(`${ROUTES.login}$`));
  await signIn.expectLoaded();
});

test("signing in from a deep link resumes it instead of landing on the dashboard", async ({
  page,
  signIn,
  twoFactor,
  cancelBooking,
}) => {
  await page.goto(CANCEL_URL);

  await signIn.signIn(MOCK_LOGIN.email, MOCK_LOGIN.password);
  await twoFactor.expectLoaded();
  await twoFactor.typeCode(MOCK_LOGIN.code);

  await expect(page).toHaveURL(new RegExp(`${CANCEL_URL}$`));
  await expect(page).not.toHaveURL(new RegExp(`${DEFAULT_ROUTE}$`));
  await cancelBooking.expectOpen();
  await cancelBooking.expectLoaded();
});

test("a trusted device resumes the deep link without a second factor", async ({
  page,
  signIn,
  cancelBooking,
}) => {
  await page.goto(CANCEL_URL);

  // `trusted@setucare.in` is authenticated outright — the resume must survive that shorter path
  // too, because it takes a completely different branch through useLogin.
  await signIn.signIn("trusted@setucare.in", MOCK_LOGIN.password);

  await expect(page).toHaveURL(new RegExp(`${CANCEL_URL}$`));
  await cancelBooking.expectOpen();
});
