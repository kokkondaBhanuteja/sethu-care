import { expect, type Locator, type Page } from "@playwright/test";

import { ROUTES } from "../../src/routes/routes.constants";

/** BOX 52 / 83 — email + password, the console's only front door. */
export class SignInPage {
  readonly page: Page;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly alert: Locator;
  readonly provisioningNote: Locator;
  readonly forgotPassword: Locator;

  constructor(page: Page) {
    this.page = page;
    this.email = page.getByLabel("Email");
    this.password = page.getByLabel("Password", { exact: true });
    this.submit = page.getByRole("button", { name: "Continue" });
    this.alert = page.getByRole("alert");
    this.provisioningNote = page.getByText("Admin accounts are created by your Super Admin.");
    this.forgotPassword = page.getByRole("link", { name: "Forgot password?" });
  }

  async goto(): Promise<void> {
    await this.page.goto(ROUTES.login);
  }

  async expectLoaded(): Promise<void> {
    await expect(this.email).toBeVisible();
    await expect(this.submit).toBeVisible();
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  async expectAlert(message: string | RegExp): Promise<void> {
    await expect(this.alert.first()).toHaveText(message);
  }

  /** Locked and offline both make the form inert while leaving the reset link usable (§5.8). */
  async expectFormInert(): Promise<void> {
    await expect(this.email).toBeDisabled();
    await expect(this.password).toBeDisabled();
    await expect(this.submit).toBeDisabled();
  }
}
