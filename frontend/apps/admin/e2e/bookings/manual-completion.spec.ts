import { expect, test } from "../fixtures";
import { BOOKING_TRIGGERS } from "../support/mockTriggers";
import { tick } from "../support/controls";

/**
 * Admin-verified manual completion (BOX 31–35) — the flow that closes a booking without the
 * customer's OTP. Four steps, three evidence gates, and NO undo, ever.
 *
 * These tests exist because this route was once dead for every booking id: OtpArrivedInterrupt
 * formatted an empty ISO string in its body, which React runs even while its Modal is closed, and
 * the RangeError killed the route before any data arrived. Fixed on both sides — the component
 * returns null when closed, and the date formatters render a dash rather than throwing. Every test
 * below asserts the modal is open BEFORE it touches anything, which is what caught it.
 */

/**
 * Every test asserts the modal is open BEFORE it touches anything. That is the assertion the defect
 * kills, so each test fails on it in seconds rather than timing out against a screen that will
 * never exist.
 */
test.describe("manual completion", () => {
  test.beforeEach(async ({ manualCompletion }) => {
    await manualCompletion.goto(BOOKING_TRIGGERS.ordinary);
  });

  test("the flow opens and names all four steps", async ({ manualCompletion }) => {
    await manualCompletion.expectOpen();
    await manualCompletion.expectAllFourSteps();
  });

  test("the bypass warning is pinned above the scroll region", async ({ manualCompletion }) => {
    await manualCompletion.expectOpen();
    await expect(manualCompletion.bypassNotice).toBeVisible();
  });

  test("the route does not land on the error boundary", async ({ manualCompletion, shell }) => {
    // Open first: without it the assertion can win the race against the render that throws, and
    // "no error boundary yet" would read as a pass.
    await manualCompletion.expectOpen();
    await shell.expectNoErrorBoundary();
  });

  test("step 1 gates on a reason code", async ({ manualCompletion }) => {
    await manualCompletion.expectOpen();
    await expect(manualCompletion.continueButton).toBeDisabled();

    await manualCompletion.chooseReason("Customer phone unreachable");

    await expect(manualCompletion.continueButton).toBeEnabled();
  });

  test("step 3 collects three attestations and a real sentence", async ({ manualCompletion }) => {
    await manualCompletion.expectOpen();
    await manualCompletion.chooseReason("Customer phone unreachable");
    await manualCompletion.continueButton.click();
    await manualCompletion.continueButton.click();

    await expect(manualCompletion.attestation("I have spoken to the provider")).toBeVisible();
    await expect(
      manualCompletion.attestation("I have attempted to reach the customer"),
    ).toBeVisible();
    await expect(
      manualCompletion.attestation("I believe the work was genuinely completed"),
    ).toBeVisible();
  });

  test("committing announces the result with NO undo", async ({ manualCompletion }) => {
    await manualCompletion.expectOpen();
    await manualCompletion.chooseReason("Customer phone unreachable");
    await manualCompletion.continueButton.click();
    await manualCompletion.continueButton.click();

    for (const label of [
      "I have spoken to the provider",
      "I have attempted to reach the customer",
      "I believe the work was genuinely completed",
    ]) {
      await tick(manualCompletion.attestation(label));
    }
    await manualCompletion.page
      .getByRole("textbox", { name: /Notes \(required\)/ })
      .fill("Customer left the premises and the provider confirmed the work by photo.");
    await manualCompletion.continueButton.click();
    await manualCompletion.button("Confirm with biometrics").click();
    await manualCompletion.passStepUp("Confirm");

    // Irreversible on purpose: a completion notifies the customer and releases payout eligibility.
    await manualCompletion.expectToast("Booking completed (Admin Verified)");
    await manualCompletion.expectNoUndo();
  });
});

test.describe("manual completion evidence gates", () => {
  test("Continue is blocked while evidence is missing", async ({ manualCompletion }) => {
    await manualCompletion.goto(BOOKING_TRIGGERS.evidenceMissing);
    await manualCompletion.expectOpen();
    await manualCompletion.chooseReason("Customer phone unreachable");
    await manualCompletion.continueButton.click();

    // B-8809 has zero logged call attempts: the gate names the missing item and offers the fix.
    await expect(manualCompletion.evidenceBlockedNote).toBeVisible();
    await expect(manualCompletion.callCustomer).toBeVisible();
    await expect(manualCompletion.continueButton).toBeDisabled();
  });

  test("the 30-minute lock explains itself instead of hiding the action", async ({
    manualCompletion,
  }) => {
    await manualCompletion.goto(BOOKING_TRIGGERS.tooEarly);

    await expect(
      manualCompletion.page.getByRole("heading", {
        name: /Manual completion available in \d+ min/,
      }),
    ).toBeVisible();
  });
});
