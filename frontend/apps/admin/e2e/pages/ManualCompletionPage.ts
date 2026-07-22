import { expect, type Locator, type Page } from "@playwright/test";

import { ROUTES } from "../../src/routes/routes.constants";
import { ActionFlowPage } from "./ActionFlowPage";

/**
 * BOX 31–35 — admin-verified completion, which bypasses the customer's OTP. Four steps: reason,
 * evidence, verify (three attestations plus a 20-character note), confirm. No undo, ever.
 */
export class ManualCompletionPage extends ActionFlowPage {
  readonly stepRail: Locator;
  readonly bypassNotice: Locator;
  readonly continueButton: Locator;
  readonly evidenceBlockedNote: Locator;
  readonly callCustomer: Locator;

  constructor(page: Page) {
    super(page, "Manual completion");
    this.stepRail = page.getByRole("navigation", { name: "Manual completion steps" });
    this.bypassNotice = page.getByText("This bypasses OTP verification");
    this.continueButton = this.button("Continue");
    this.evidenceBlockedNote = page.getByText("Log a call attempt to continue.");
    this.callCustomer = this.button("Call customer");
  }

  async goto(bookingId: string): Promise<void> {
    await this.page.goto(ROUTES.bookingManualComplete(bookingId));
  }

  /** The rail NAMES all four steps — the deterrent is the itinerary, not a progress fraction. */
  async expectAllFourSteps(): Promise<void> {
    await expect(this.stepRail.getByText("Reason")).toBeVisible();
    await expect(this.stepRail.getByText("Evidence")).toBeVisible();
    await expect(this.stepRail.getByText("Verify")).toBeVisible();
    await expect(this.stepRail.getByText("Confirm")).toBeVisible();
  }

  attestation(label: string): Locator {
    return this.page.getByRole("checkbox", { name: label });
  }
}
