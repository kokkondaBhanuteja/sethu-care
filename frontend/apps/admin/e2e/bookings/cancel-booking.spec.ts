import { ROUTES } from "../../src/routes/routes.constants";
import { expect, test } from "../fixtures";
import { KNOWN_DEFECTS } from "../support/knownDefects";
import { BOOKING_TRIGGERS } from "../support/mockTriggers";

/**
 * Emergency cancellation (BOX 26–28). High risk in the §10.3 register: reason code required,
 * step-up required, 10-second undo window.
 *
 * Every test that must PRESS "Continue to confirm" is an expected failure today: the ui-web Modal
 * migration left the commit button below a viewport nothing can scroll
 * (`KNOWN_DEFECTS.modalFooterUnreachable`). Left failing on purpose — do not weaken.
 */

test.beforeEach(async ({ cancelBooking }) => {
  await cancelBooking.goto(BOOKING_TRIGGERS.ordinary);
  await cancelBooking.expectLoaded();
});

test("the screen leads with the consequence, not the form", async ({ cancelBooking }) => {
  await expect(cancelBooking.impact).toBeVisible();
  await expect(cancelBooking.dialog.getByText(/will be notified by SMS/)).toBeVisible();
  await expect(cancelBooking.dialog.getByText(/refund will be initiated/)).toBeVisible();
});

test("a reason is required before the commit can be reached", async ({ cancelBooking }) => {
  test.fail(true, KNOWN_DEFECTS.modalFooterUnreachable);
  await cancelBooking.expectNoReasonChosen();

  await cancelBooking.continueToConfirm.click();

  // The step-up never opens: the form refuses first, and says why.
  await expect(cancelBooking.stepUpPasscode).toBeHidden();
  await expect(cancelBooking.dialog.getByText("Pick a reason before continuing.")).toBeVisible();
});

test("choosing a reason and continuing raises the step-up challenge", async ({ cancelBooking }) => {
  test.fail(true, KNOWN_DEFECTS.modalFooterUnreachable);
  await cancelBooking.chooseReason("Duplicate booking");
  await cancelBooking.continueToConfirm.click();

  // Fresh verification, not a tap-to-confirm dialog (spec §5.5).
  await expect(
    cancelBooking.page.getByRole("dialog", { name: "Confirm cancellation" }),
  ).toBeVisible();
  await expect(cancelBooking.stepUpPasscode).toBeVisible();
});

test("the step-up restates what is about to be committed", async ({ cancelBooking }) => {
  test.fail(true, KNOWN_DEFECTS.modalFooterUnreachable);
  await cancelBooking.chooseReason("Duplicate booking");
  await cancelBooking.continueToConfirm.click();

  const challenge = cancelBooking.page.getByRole("dialog", { name: "Confirm cancellation" });
  await expect(challenge.getByText(/Duplicate booking/)).toBeVisible();
  await expect(challenge.getByText(new RegExp(`#${BOOKING_TRIGGERS.ordinary}`))).toBeVisible();
});

test("confirming cancels the booking and offers an undo", async ({ page, cancelBooking }) => {
  test.fail(true, KNOWN_DEFECTS.modalFooterUnreachable);
  await cancelBooking.chooseReason("Duplicate booking");
  await cancelBooking.continueToConfirm.click();
  await cancelBooking.passStepUp("Confirm");

  await expect(page).toHaveURL(new RegExp(`${ROUTES.bookingDetail(BOOKING_TRIGGERS.ordinary)}$`));
  await cancelBooking.expectToast("Booking cancelled · refund initiated");
  // 10 seconds, from the risk register — the screen never restates the number.
  await expect(cancelBooking.undo).toBeVisible();
});

test("a booking with the technician on site warns before it lets you cancel", async ({
  cancelBooking,
}) => {
  await cancelBooking.goto(BOOKING_TRIGGERS.technicianOnSite);

  await expect(cancelBooking.dialog.getByText(/is on site and working/)).toBeVisible();
  await expect(cancelBooking.button("Escalate instead")).toBeVisible();
});
