import { test as base } from "@playwright/test";

import { ActionFlowPage } from "./pages/ActionFlowPage";
import { AdminShellPage } from "./pages/AdminShellPage";
import { ApplicationReviewPage } from "./pages/ApplicationReviewPage";
import { CancelBookingPage } from "./pages/CancelBookingPage";
import { ListScreenPage } from "./pages/ListScreenPage";
import { ManualCompletionPage } from "./pages/ManualCompletionPage";
import { RefundPage } from "./pages/RefundPage";
import { SignInPage } from "./pages/SignInPage";
import { SuspendProviderPage } from "./pages/SuspendProviderPage";
import { TwoFactorPage } from "./pages/TwoFactorPage";

/** Page objects as test parameters, so no spec constructs its own screen wrapper. */
interface AdminFixtures {
  shell: AdminShellPage;
  signIn: SignInPage;
  twoFactor: TwoFactorPage;
  bookingsList: ListScreenPage;
  cancelBooking: CancelBookingPage;
  manualCompletion: ManualCompletionPage;
  refund: RefundPage;
  suspendProvider: SuspendProviderPage;
  applicationReview: ApplicationReviewPage;
  listScreen: ListScreenPage;
  actionFlow: (dialogName: string) => ActionFlowPage;
}

export const test = base.extend<AdminFixtures>({
  shell: async ({ page }, use) => {
    await use(new AdminShellPage(page));
  },
  signIn: async ({ page }, use) => {
    await use(new SignInPage(page));
  },
  twoFactor: async ({ page }, use) => {
    await use(new TwoFactorPage(page));
  },
  bookingsList: async ({ page }, use) => {
    await use(new ListScreenPage(page));
  },
  cancelBooking: async ({ page }, use) => {
    await use(new CancelBookingPage(page));
  },
  manualCompletion: async ({ page }, use) => {
    await use(new ManualCompletionPage(page));
  },
  refund: async ({ page }, use) => {
    await use(new RefundPage(page));
  },
  suspendProvider: async ({ page }, use) => {
    await use(new SuspendProviderPage(page));
  },
  applicationReview: async ({ page }, use) => {
    await use(new ApplicationReviewPage(page));
  },
  listScreen: async ({ page }, use) => {
    await use(new ListScreenPage(page));
  },
  actionFlow: async ({ page }, use) => {
    await use((dialogName: string) => new ActionFlowPage(page, dialogName));
  },
});

export { expect } from "@playwright/test";
