import { expect, type Locator, type Page } from "@playwright/test";

import { ROUTES } from "../../src/routes/routes.constants";
import { chooseOption } from "../support/controls";
import { ActionFlowPage } from "./ActionFlowPage";

/**
 * BOX 45–47 — the application record, and the rejection it can end in. Rejection is final and
 * carries no undo: the applicant is notified by SMS the moment it commits.
 */
export class ApplicationReviewPage extends ActionFlowPage {
  readonly reject: Locator;
  readonly approve: Locator;
  readonly rejectReasonGroup: Locator;
  readonly rejectNote: Locator;
  readonly confirmReject: Locator;
  readonly finality: Locator;

  constructor(page: Page) {
    super(page, "Reject application");
    this.reject = page.getByRole("button", { name: "Reject", exact: true });
    this.approve = page.getByRole("button", { name: "Approve", exact: true });
    this.rejectReasonGroup = this.dialog.getByRole("group", { name: "Reason" });
    this.rejectNote = this.dialog.getByRole("textbox", { name: "Note (required)" });
    this.confirmReject = this.dialog.getByRole("button", {
      name: "Reject application with biometrics",
    });
    this.finality = page.getByText("Rejection is final. The applicant is notified by SMS.");
  }

  async goto(applicationId: string): Promise<void> {
    await this.page.goto(ROUTES.applicationReview(applicationId));
  }

  async openReject(): Promise<void> {
    await this.reject.click();
    await this.expectOpen();
  }

  async chooseRejectReason(reason: string): Promise<void> {
    await chooseOption(this.rejectReasonGroup, reason);
  }

  /** The note has a 20-character floor — a reason code alone is not an explanation. */
  async expectNoteCounter(current: number): Promise<void> {
    await expect(this.dialog.getByText(`${current} / 20 minimum`)).toBeVisible();
  }
}
