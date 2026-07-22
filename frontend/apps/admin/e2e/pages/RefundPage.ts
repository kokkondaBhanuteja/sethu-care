import { expect, type Locator, type Page } from "@playwright/test";

import { ROUTES } from "../../src/routes/routes.constants";
import { chooseOption } from "../support/controls";
import { ActionFlowPage } from "./ActionFlowPage";

/** BOX 29–30 — money leaves the platform here. Irreversible by design: there is no undo. */
export class RefundPage extends ActionFlowPage {
  readonly typeGroup: Locator;
  readonly amount: Locator;
  readonly continueToConfirm: Locator;
  readonly rateLimitedTitle: Locator;

  constructor(page: Page) {
    super(page, "Issue refund");
    this.typeGroup = this.group("Refund type");
    this.amount = page.getByRole("spinbutton", { name: /^Amount/ });
    this.continueToConfirm = this.button("Continue to confirm");
    this.rateLimitedTitle = page.getByText("Refund limit reached");
  }

  async goto(bookingId: string): Promise<void> {
    await this.page.goto(ROUTES.bookingRefund(bookingId));
    await this.expectOpen();
  }

  async chooseType(type: string): Promise<void> {
    await chooseOption(this.typeGroup, type);
  }

  /**
   * The ₹500 goodwill cap and the hourly rate limit are BOTH server rules; the form mirrors them so
   * it can explain itself before a round trip, and never decides on its own.
   *
   * The message is announced twice on purpose — once as the field's own error and once in the
   * amount summary — so the first live region is enough.
   */
  async expectCapError(): Promise<void> {
    await expect(
      this.page.getByRole("alert").filter({ hasText: "goodwill cap" }).first(),
    ).toBeVisible();
    await expect(this.amount).toHaveAttribute("aria-invalid", "true");
  }
}
