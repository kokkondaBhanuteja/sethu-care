import { expect, type Locator, type Page } from "@playwright/test";

import { chooseOption } from "../support/controls";

/**
 * Everything the destructive and financial flows share: the modal they run in, the step-up
 * challenge that gates the commit, and the toast that reports the result.
 *
 * Step-up is fresh verification, not a confirm dialog (`hooks/useStepUp.ts`) — no plugin is
 * installed, so the challenge collects a passcode and `StepUpChallenge` says so out loud.
 */
export class ActionFlowPage {
  readonly page: Page;
  readonly dialog: Locator;
  readonly stepUpPasscode: Locator;
  readonly toast: Locator;
  readonly undo: Locator;

  constructor(page: Page, dialogName: string) {
    this.page = page;
    this.dialog = page.getByRole("dialog", { name: dialogName });
    this.stepUpPasscode = page.getByLabel("Passcode", { exact: true });
    this.toast = page.getByRole("status");
    this.undo = this.toast.getByRole("button", { name: "Undo" });
  }

  async expectOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible();
  }

  group(legend: string): Locator {
    return this.page.getByRole("group", { name: legend });
  }

  async chooseReason(reason: string): Promise<void> {
    await chooseOption(this.group("Reason (required)"), reason);
  }

  button(name: string): Locator {
    return this.page.getByRole("button", { name, exact: true });
  }

  /** Only the challenge itself is entered here — the 60-second window belongs to `useStepUp`. */
  async passStepUp(confirmLabel: string, passcode = "1234"): Promise<void> {
    await expect(this.stepUpPasscode).toBeVisible();
    await this.stepUpPasscode.fill(passcode);
    await this.button(confirmLabel).click();
  }

  async expectToast(message: string | RegExp): Promise<void> {
    await expect(this.toast.filter({ hasText: message })).toBeVisible();
  }

  /**
   * Refund, manual completion and application rejection have NO undo on purpose
   * (`lib/permissions/actions.ts`, spec §10.3): each has an immediate outside-world effect and is
   * corrected by a compensating, itself-audited action. An Undo appearing on one of them would be
   * a serious regression, so its absence is asserted rather than assumed.
   */
  async expectNoUndo(): Promise<void> {
    await expect(this.toast.first()).toBeVisible();
    await expect(this.undo).toHaveCount(0);
  }
}
