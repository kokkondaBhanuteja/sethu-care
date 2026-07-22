import { expect, type Locator, type Page } from "@playwright/test";

import { OTP_LENGTH } from "../../src/features/auth/auth.constants";

/** BOX 55–57 / 88–91 — the six-cell admin login code, plus the trusted-device picker behind it. */
export class TwoFactorPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly cells: Locator;
  readonly verify: Locator;
  readonly alert: Locator;
  readonly deviceLimitHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Verify it's you" });
    this.cells = page.getByRole("textbox", { name: /6-digit verification code \d/ });
    this.verify = page.getByRole("button", { name: "Verify" });
    this.alert = page.getByRole("alert");
    this.deviceLimitHeading = page.getByRole("heading", { name: /devices? already trusted/ });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.cells).toHaveCount(OTP_LENGTH);
  }

  /**
   * Type the whole code the way an operator does: focus the first cell and keep typing, letting
   * auto-advance carry focus. Never one `fill()` per cell — that would skip the auto-advance path,
   * which is exactly where digits used to be swallowed.
   */
  async typeCode(code: string): Promise<void> {
    await this.cells.first().focus();
    await this.page.keyboard.type(code);
  }

  /** Asserts the first `code.length` cells, so a partial code can be checked without submitting. */
  async expectCode(code: string): Promise<void> {
    for (const [index, digit] of [...code].entries()) {
      await expect(this.cells.nth(index)).toHaveValue(digit);
    }
  }

  async expectCleared(): Promise<void> {
    for (let index = 0; index < OTP_LENGTH; index += 1) {
      await expect(this.cells.nth(index)).toHaveValue("");
    }
  }
}
