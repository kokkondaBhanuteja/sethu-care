import { OTP_LENGTH } from "../../src/features/auth/auth.constants";
import { expect, test } from "../fixtures";
import { MOCK_LOGIN } from "../support/mockTriggers";

/**
 * The six-cell code control, locked down.
 *
 * This had a real bug: auto-advance moved focus in the same tick as the keystroke, before React had
 * re-rendered with the new value, so the `onFocus` guard read a stale `value` prop, decided the
 * newly focused cell was past the end and bounced focus back one cell — silently swallowing every
 * second digit. `CodeInput` now keeps a `committedRef`; these tests are the fence around it.
 *
 * The keystroke tests deliberately stop at FIVE digits. The design auto-submits on the sixth
 * (`onComplete`), so a six-digit assertion would be racing a form submission rather than testing
 * the control. The sixth digit gets its own test, which asserts the submission instead.
 */

/** Five digits, no two the same, so a swallowed keystroke cannot hide behind a repeat. */
const PARTIAL_CODE = "13579";

test.beforeEach(async ({ signIn, twoFactor }) => {
  await signIn.goto();
  await signIn.signIn(MOCK_LOGIN.email, MOCK_LOGIN.password);
  await twoFactor.expectLoaded();
});

test("every keystroke lands in its own cell", async ({ twoFactor }) => {
  await twoFactor.typeCode(PARTIAL_CODE);

  await twoFactor.expectCode(PARTIAL_CODE);
  await expect(twoFactor.cells.nth(OTP_LENGTH - 1)).toHaveValue("");
});

test("auto-advance leaves focus on the next empty cell, never one behind", async ({
  twoFactor,
}) => {
  await twoFactor.typeCode(PARTIAL_CODE);

  await expect(twoFactor.cells.nth(PARTIAL_CODE.length)).toBeFocused();
});

test("backspace retreats one cell at a time", async ({ page, twoFactor }) => {
  await twoFactor.typeCode(PARTIAL_CODE);

  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");

  await expect(twoFactor.cells.nth(4)).toHaveValue("");
  await expect(twoFactor.cells.nth(3)).toHaveValue("");
  await expect(twoFactor.cells.nth(2)).toHaveValue("5");
});

test("Verify stays disabled until all six cells are filled", async ({ twoFactor }) => {
  await twoFactor.typeCode(PARTIAL_CODE);

  await expect(twoFactor.verify).toBeDisabled();
});

test("the sixth digit completes the code and submits it", async ({ page, twoFactor }) => {
  // All six digits reached the control, which is what "submitted" proves: the mock rejects any code
  // that is not six digits long, so a swallowed keystroke could never get past this.
  await twoFactor.typeCode(MOCK_LOGIN.code);

  await expect(page).not.toHaveURL(/\/login/);
});

test("a pasted code fills every cell", async ({ page, twoFactor }) => {
  // Paste is permitted on purpose — blocking it discourages password managers (spec §6.2).
  await twoFactor.cells.first().focus();
  await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.setData("text", "13579");
    document.activeElement?.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true }),
    );
  });

  await twoFactor.expectCode(PARTIAL_CODE);
});

test("every cell announces its position inside the labelled group", async ({ page, twoFactor }) => {
  await expect(page.getByRole("group", { name: "6-digit verification code" })).toBeVisible();

  for (let index = 1; index <= OTP_LENGTH; index += 1) {
    await expect(
      twoFactor.page.getByRole("textbox", { name: `6-digit verification code ${index}` }),
    ).toBeVisible();
  }
});
