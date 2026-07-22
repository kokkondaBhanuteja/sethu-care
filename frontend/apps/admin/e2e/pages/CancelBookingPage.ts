import { expect, type Locator, type Page } from "@playwright/test";

import { ROUTES } from "../../src/routes/routes.constants";
import { ActionFlowPage } from "./ActionFlowPage";

/** BOX 26–28 — emergency cancellation. Reason-gated, step-up-gated, and undoable for 10s. */
export class CancelBookingPage extends ActionFlowPage {
  readonly impact: Locator;
  readonly reasonGroup: Locator;
  readonly continueToConfirm: Locator;

  constructor(page: Page) {
    super(page, "Cancel booking");
    this.impact = page.getByText("This cannot be undone");
    this.reasonGroup = this.group("Reason (required)");
    this.continueToConfirm = this.button("Continue to confirm");
  }

  async goto(bookingId: string): Promise<void> {
    await this.page.goto(ROUTES.bookingCancel(bookingId));
    await this.expectOpen();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.impact).toBeVisible();
    await expect(this.reasonGroup).toBeVisible();
  }

  /** The commit is one button away, so the reason is the last gate before the step-up. */
  async expectNoReasonChosen(): Promise<void> {
    await expect(this.reasonGroup.getByRole("radio", { checked: true })).toHaveCount(0);
  }
}
