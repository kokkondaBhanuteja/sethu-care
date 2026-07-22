import { ROUTES } from "../../src/routes/routes.constants";
import { expect, test } from "../fixtures";
import { BOOKING_TRIGGERS, PROVIDER_TRIGGERS } from "../support/mockTriggers";
import { SHELL_BREAKPOINT_PX } from "../support/env";

/**
 * The same specs at 390, 768, 1024 and 1440 (the `responsive-*` projects).
 *
 * `AdminShell` mounts exactly ONE of the two shells — mobile is never media-query-squeezed desktop
 * (spec §2.1) — so which one is in the DOM is the assertion, not a CSS check. 768 is included
 * because it is the boundary itself: `useIsDesktop()` is `(min-width: 768px)`, so at exactly 768
 * the sidebar renders.
 */

const SCREENS = [
  ROUTES.live,
  ROUTES.bookings,
  ROUTES.bookingDetail(BOOKING_TRIGGERS.ordinary),
  ROUTES.providers,
  ROUTES.providerDetail(PROVIDER_TRIGGERS.withActiveJobs),
  ROUTES.alerts,
  ROUTES.audit,
  ROUTES.securitySettings,
];

function width(page: { viewportSize: () => { width: number } | null }): number {
  const size = page.viewportSize();
  if (!size) throw new Error("This suite always sets a viewport.");
  return size.width;
}

test("the shell matches the viewport, and only one of the two is mounted", async ({
  page,
  shell,
}) => {
  await page.goto(ROUTES.live);

  if (width(page) >= SHELL_BREAKPOINT_PX) {
    await shell.expectDesktopShell();
  } else {
    await shell.expectMobileShell();
  }
});

for (const url of SCREENS) {
  test(`${url} never scrolls sideways`, async ({ page, shell }) => {
    await page.goto(url);
    await shell.expectNoErrorBoundary();

    await shell.expectNoHorizontalScroll();
  });
}

test("a full-screen modal task hides the tab bar on a phone and keeps the sidebar on desktop", async ({
  page,
  shell,
}) => {
  // Leaving the tab bar visible mid-cancellation is a one-tap exit from a half-filled irreversible
  // form that bypasses the "Discard changes?" guard — a safety property, not a stylistic one.
  await page.goto(ROUTES.bookingCancel(BOOKING_TRIGGERS.ordinary));
  await expect(
    page
      .getByRole("dialog", { name: "Cancel booking" })
      .or(page.getByRole("heading", { name: "Cancel booking" })),
  ).toBeVisible();

  if (width(page) >= SHELL_BREAKPOINT_PX) {
    await expect(shell.sidebarNav).toBeVisible();
  } else {
    await expect(shell.moreTab).toHaveCount(0);
  }
});

test("the destructive flow never scrolls sideways either", async ({ page, shell }) => {
  await page.goto(ROUTES.bookingCancel(BOOKING_TRIGGERS.ordinary));
  await expect(page.getByText("This cannot be undone")).toBeVisible();

  await shell.expectNoHorizontalScroll();
});
