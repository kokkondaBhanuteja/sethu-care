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
    // The audit log's "More filters" is the console's canonical Drawer: settings-shaped work that
    // must not hide the record it acts on.
    await page.goto(ROUTES.audit);

    const filters = page.getByRole("button", { name: "More filters" });
    await expect(filters).toBeVisible();
    await filters.focus();
    await filters.press("Enter");

    const drawer = page.getByRole("dialog", { name: "Filter entries" });
    await expect(drawer).toBeVisible();
    const focusedInside = await drawer.evaluate((panel) => panel.contains(document.activeElement));
    expect(focusedInside).toBe(true);

    await page.keyboard.press("Escape");

    await expect(drawer).toBeHidden();
    await expect(filters).toBeFocused();
  });
});
