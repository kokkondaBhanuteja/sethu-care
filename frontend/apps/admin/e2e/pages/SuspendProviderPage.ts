import { expect, type Locator, type Page } from "@playwright/test";

import { ROUTES } from "../../src/routes/routes.constants";
import { ActionFlowPage } from "./ActionFlowPage";

/**
 * BOX 36–38 — four deliberate steps, of which step 3 is the point: every active booking must be
 * explicitly reassigned or allowed to finish before a suspension can proceed.
 *
 * Action type and reason share one pane, so the rail runs 1&2 → 3 → 4 (`RAIL_INDEX_FOR_PANE`).
 */
export class SuspendProviderPage extends ActionFlowPage {
  providerId = "";
  readonly stepRail: Locator;
  readonly impact: Locator;
  readonly continueButton: Locator;
  readonly activeJobsHeading: Locator;
  readonly letThemFinish: Locator;
  readonly reassign: Locator;

  constructor(page: Page) {
    super(page, "Suspend provider");
    this.stepRail = page.getByRole("navigation", { name: "Suspend provider steps" });
    this.impact = page.getByText("This stops their income");
    this.continueButton = this.button("Continue");
    this.activeJobsHeading = page.getByRole("heading", { name: "Active jobs" });
    this.letThemFinish = page.getByRole("button", { name: "Let them finish" });
    this.reassign = page.getByRole("button", { name: "Reassign" });
  }

  async goto(providerId: string): Promise<void> {
    this.providerId = providerId;
    await this.page.goto(ROUTES.providerSuspend(providerId));
    await this.expectOpen();
  }

  step(name: string): Locator {
    return this.stepRail.getByRole("listitem").filter({ hasText: name });
  }

  /**
   * Wait for the record's queries to land before leaving step 1.
   *
   * `goNext` reads `hasActiveJobs` at click time, so a Continue pressed while the active-jobs query
   * is still in flight sees zero jobs and skips straight to Confirm. That is a real defect — see
   * "step 3 must not be skipped…" in the spec — and this is the anchor that keeps the OTHER step-3
   * tests testing step 3 rather than re-testing the race: the rail footer only renders once the
   * provider record has resolved.
   */
  async continueFromStepOne(reason: string): Promise<void> {
    await expect(this.stepRail.getByText(this.providerId)).toBeVisible();
    await this.chooseReason(reason);
    await this.continueButton.click();
  }

  async expectAllFourSteps(): Promise<void> {
    for (const name of ["Action type", "Reason", "Active jobs", "Confirm"]) {
      await expect(this.step(name)).toBeVisible();
    }
  }

  /** The counter is the modal's subtitle: "1 of 4", "3 of 4", "4 of 4". */
  async expectStepNumber(current: number): Promise<void> {
    await expect(this.dialog.getByText(`${current} of 4`)).toBeVisible();
  }

  /**
   * Resolve every listed job. The Continue button stays dead until the count reaches zero, which is
   * the whole safety property of this step.
   */
  async letEveryJobFinish(): Promise<void> {
    const count = await this.letThemFinish.count();
    for (let index = 0; index < count; index += 1) {
      await this.letThemFinish.first().click();
    }
  }
}
