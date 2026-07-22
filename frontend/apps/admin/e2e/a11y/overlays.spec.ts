import { ROUTES } from "../../src/routes/routes.constants";
import { expect, test } from "../fixtures";
import { APPLICATION_TRIGGERS, BOOKING_TRIGGERS } from "../support/mockTriggers";

/**
 * Keyboard-only paths through the overlays (`hooks/useFocusTrap.ts`).
 *
 * Modals in this console confirm cancellations and refunds. Tabbing behind one to the page below is
 * how an operator confirms the wrong thing, so the trap, the Escape exit and the focus return are
 * asserted rather than assumed.
 */

test.describe("a modal task route", () => {
  test.beforeEach(async ({ cancelBooking }) => {
    await cancelBooking.goto(BOOKING_TRIGGERS.ordinary);
    await cancelBooking.expectLoaded();
  });

  test("takes focus into itself on open", async ({ cancelBooking }) => {
    const focusedInsideDialog = await cancelBooking.dialog.evaluate((dialog) =>
      dialog.contains(document.activeElement),
    );
    expect(focusedInsideDialog).toBe(true);
  });

  test("keeps Tab inside itself", async ({ page, cancelBooking }) => {
    for (let press = 0; press < 30; press += 1) {
      await page.keyboard.press("Tab");
      const stillInside = await cancelBooking.dialog.evaluate((dialog) =>
        dialog.contains(document.activeElement),
      );
      expect(stillInside, `focus escaped the dialog after ${press + 1} tabs`).toBe(true);
    }
  });

  test("keeps Shift+Tab inside itself", async ({ page, cancelBooking }) => {
    for (let press = 0; press < 30; press += 1) {
      await page.keyboard.press("Shift+Tab");
      const stillInside = await cancelBooking.dialog.evaluate((dialog) =>
        dialog.contains(document.activeElement),
      );
      expect(stillInside, `focus escaped the dialog after ${press + 1} back-tabs`).toBe(true);
    }
  });
});

test.describe("the step-up challenge", () => {
  test("Escape dismisses it and returns to the form behind it", async ({ page, cancelBooking }) => {
    // Blocked, not broken: the challenge can only be raised by pressing "Continue to confirm",
    // which the modal defect puts out of reach — so this behaviour is untestable until it lands.
    await cancelBooking.goto(BOOKING_TRIGGERS.ordinary);
    await cancelBooking.chooseReason("Duplicate booking");
    await cancelBooking.continueToConfirm.click();

    const challenge = page.getByRole("dialog", { name: "Confirm cancellation" });
    await expect(challenge).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(challenge).toBeHidden();
    // The cancel form is still there, still filled in — Escape backs out of the challenge only.
    await cancelBooking.expectOpen();
    await expect(
      cancelBooking.reasonGroup.getByRole("radio", { name: /^Duplicate booking/ }),
    ).toBeChecked();
  });
});

test.describe("a dialog opened from a trigger", () => {
  test("returns focus to the trigger when it closes", async ({ page, applicationReview }) => {
    await applicationReview.goto(APPLICATION_TRIGGERS.pending);
    await expect(applicationReview.reject).toBeVisible();

    await applicationReview.reject.focus();
    await applicationReview.reject.press("Enter");
    await applicationReview.expectOpen();

    await page.keyboard.press("Escape");

    await expect(applicationReview.dialog).toBeHidden();
    await expect(applicationReview.reject).toBeFocused();
  });
});

test.describe("a drawer", () => {
  test("traps focus, and Escape returns it to the control that opened it", async ({ page }) => {
    // OPEN DEFECT — route-mounted drawers lose focus on close. The redispatch drawer lives on a
    // sibling route of the booking detail, so opening it UNMOUNTS the record screen: the Drawer
    // adapter's captured opener is a detached node, and Escape drops a keyboard operator onto
    // <body> (WCAG 2.4.3). Fix options: nest the action routes under the detail so the record
    // stays mounted, or hand focus to the action bar explicitly on return navigation. (The prior
    // canonical drawer, audit "More filters", was removed as a duplicate of its filter band.)
    test.fail(
      true,
      "Route-mounted Drawer cannot return focus: the opener unmounts with the detail screen.",
    );
    await page.goto(ROUTES.bookingDetail("B-8823"));

    const searchAgain = page.getByRole("button", { name: "Search again" }).first();
    await expect(searchAgain).toBeVisible();
    await searchAgain.focus();
    await searchAgain.press("Enter");

    const drawer = page.getByRole("dialog", { name: "Search for a provider again" });
    await expect(drawer).toBeVisible();
    const focusedInside = await drawer.evaluate((panel) => panel.contains(document.activeElement));
    expect(focusedInside).toBe(true);

    await page.keyboard.press("Escape");

    await expect(drawer).toBeHidden();
    await expect(searchAgain).toBeFocused();
  });
});
