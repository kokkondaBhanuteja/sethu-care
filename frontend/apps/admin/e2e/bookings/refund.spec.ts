import { expect, test } from "../fixtures";
import { BOOKING_TRIGGERS, GOODWILL_CAP_BREACH_RUPEES } from "../support/mockTriggers";

/**
 * Refunds (BOX 29–30). Money leaves the platform here, so the two server limits the form mirrors —
 * the ₹500 goodwill cap and the hourly rate limit — get their own tests, and the absence of an undo
 * gets one too.
 */

test("the ordinary refund path loads with the booking's payment restated", async ({ refund }) => {
  await refund.goto(BOOKING_TRIGGERS.refund);

  await expect(refund.dialog.getByText(/paid by UPI/)).toBeVisible();
  await expect(refund.typeGroup).toBeVisible();
});

test("a goodwill credit above the cap is refused with the reason and the number", async ({
  refund,
}) => {
  await refund.goto(BOOKING_TRIGGERS.refund);

  await refund.chooseType("Goodwill credit");
  await refund.amount.fill(GOODWILL_CAP_BREACH_RUPEES);

  await refund.expectCapError();
  // Announced twice by design — as the field's own error and again in the amount summary.
  await expect(
    refund.dialog.getByText(/Amounts above the cap need Super Admin approval on desktop\./).first(),
  ).toBeVisible();
});

test("the cap error blocks the commit rather than only colouring the field", async ({ refund }) => {
  await refund.goto(BOOKING_TRIGGERS.refund);

  await refund.chooseType("Goodwill credit");
  await refund.amount.fill(GOODWILL_CAP_BREACH_RUPEES);

  await expect(refund.continueToConfirm).toBeDisabled();
});

test("the rate-limited state replaces the form instead of disabling it", async ({ refund }) => {
  await refund.goto(BOOKING_TRIGGERS.refundRateLimited);

  await expect(refund.rateLimitedTitle).toBeVisible();
  await expect(refund.dialog.getByText(/This limit exists as a fraud control/)).toBeVisible();
  // A disabled form invites hunting for the disabled control; the form is gone instead.
  await expect(refund.typeGroup).toHaveCount(0);
  await expect(refund.continueToConfirm).toBeDisabled();
});

test("a completed refund is announced with NO undo", async ({ refund }) => {
  await refund.goto(BOOKING_TRIGGERS.refund);

  await refund.chooseReason("Service not delivered");
  await refund.continueToConfirm.click();
  await refund.passStepUp("Confirm");

  await refund.expectToast("Refund initiated");
  // A refund initiates an external gateway call. It is corrected by a compensating, itself-audited
  // action — never by a silent reversal (spec §10.3). An Undo here would be a serious regression.
  await refund.expectNoUndo();
});

test("a refund needs a reason before the step-up can be reached", async ({ refund }) => {
  await refund.goto(BOOKING_TRIGGERS.refund);

  await refund.continueToConfirm.click();

  await expect(refund.stepUpPasscode).toBeHidden();
  await expect(refund.dialog.getByText("Pick a reason before continuing.")).toBeVisible();
});
