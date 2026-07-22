import { expect, type Locator, type Page } from "@playwright/test";

import { ERROR_STATE_TIMEOUT_MS } from "../support/env";

/**
 * Any main list screen, viewed through the five states `QueryBoundary` switches between.
 *
 * Every §4.10 state renders through `EmptyState`, so its title is the region's heading and the
 * retry affordance is a real button — a blank page or a crash is the failure this asserts against.
 */
export class ListScreenPage {
  readonly page: Page;
  readonly main: Locator;
  readonly errorTitle: Locator;
  readonly retry: Locator;

  constructor(page: Page) {
    this.page = page;
    this.main = page.getByRole("main");
    this.errorTitle = page.getByRole("heading", { name: "Something went wrong" });
    this.retry = page.getByRole("button", { name: "Retry" });
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  /** The query client retries twice with backoff before the error state is allowed to appear. */
  async expectErrorAndRetry(): Promise<void> {
    await expect(this.errorTitle.first()).toBeVisible({ timeout: ERROR_STATE_TIMEOUT_MS });
    await expect(this.retry.first()).toBeEnabled();
  }

  async expectEmptyState(title: string): Promise<void> {
    await expect(this.page.getByRole("heading", { name: title })).toBeVisible();
  }
}
