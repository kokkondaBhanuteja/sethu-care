import { expect, test } from "../fixtures";
import { BOOKING_TRIGGERS } from "../support/mockTriggers";
import { tick } from "../support/controls";

/**
 * Admin-verified manual completion (BOX 31–35) — the flow that closes a booking without the
 * customer's OTP. Four steps, three evidence gates, and NO undo, ever.
 *
 * ┌────────────────────────────────────────────────────────────────────────────────────────────┐
 * │ DEFECT — every test in this file is `test.fail()`. The route does not render at all.        │
 * │                                                                                             │
 * │ `ManualCompletion.desktop.tsx:118` and `ManualCompletion.mobile.tsx:109` render             │
 * │ `<OtpArrivedInterrupt verifiedAtIso={context?.otpArrivedAtIso ?? ""} …/>` unconditionally.   │
 * │ `OtpArrivedInterrupt` calls `formatTime(verifiedAtIso)` in its own body, which React runs    │
 * │ whether or not the Modal inside it is open. `formatTime("")` is                             │
 * │ `Intl.DateTimeFormat.format(new Date(""))` → `RangeError: Invalid time value`.               │
 * │                                                                                             │
 * │ `context` is null on first render, so the throw happens before any booking data arrives:     │
 * │ /bookings/<any id>/manual-complete dies in RouteErrorBoundary for EVERY booking — including  │
 * │ B-8801, the only fixture that has an `otpArrivedAtIso` at all. Verified by hand at 1440 and  │
 * │ at 390 on B-8823, B-8809, B-8815 and B-8801.                                                 │
 * │                                                                                             │
 * │ Do not weaken these tests. Delete the `test.fail()` lines once the app is fixed.             │
 * └────────────────────────────────────────────────────────────────────────────────────────────┘
 */

const DEFECT = "RangeError: Invalid time value — OtpArrivedInterrupt formats an empty ISO string";

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
    test.fail(true, DEFECT);

    await manualCompletion.expectOpen();
    await manualCompletion.expectAllFourSteps();
  });

  test("the bypass warning is pinned above the scroll region", async ({ manualCompletion }) => {
    test.fail(true, DEFECT);

    await manualCompletion.expectOpen();
    await expect(manualCompletion.bypassNotice).toBeVisible();
  });

  test("the route does not land on the error boundary", async ({ manualCompletion, shell }) => {
    test.fail(true, DEFECT);

    // Open first: without it the assertion can win the race against the render that throws, and
    // "no error boundary yet" would read as a pass.
    await manualCompletion.expectOpen();
    await shell.expectNoErrorBoundary();
  });

  test("step 1 gates on a reason code", async ({ manualCompletion }) => {
    test.fail(true, DEFECT);

    await manualCompletion.expectOpen();
    await expect(manualCompletion.continueButton).toBeDisabled();

    await manualCompletion.chooseReason("Customer phone unreachable");

    await expect(manualCompletion.continueButton).toBeEnabled();
  });

  test("step 3 collects three attestations and a real sentence", async ({ manualCompletion }) => {
    test.fail(true, DEFECT);

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
    test.fail(true, DEFECT);

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
    test.fail(true, DEFECT);

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
    test.fail(true, DEFECT);

    await manualCompletion.goto(BOOKING_TRIGGERS.tooEarly);

    await expect(
      manualCompletion.page.getByRole("heading", {
        name: /Manual completion available in \d+ min/,
      }),
    ).toBeVisible();
  });
});
