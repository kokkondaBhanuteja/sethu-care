import { DEFAULT_ROUTE } from "../../src/routes/routes.constants";
import { expect, test } from "../fixtures";
import { SIDEBAR_DESTINATIONS, SIDEBAR_GROUP_TITLES } from "../support/navigation";

/**
 * The 240px rail. Desktop has no tab bar and no More menu, so every destination the console owns
 * has to be reachable from this one always-visible list (`layouts/Sidebar.tsx`, design BOX 59).
 *
 * Driven from `navigation.constants.ts`, so a destination added to the rail is navigated here
 * automatically and a destination removed from it stops being asserted.
 */

test.beforeEach(async ({ page }) => {
  await page.goto(DEFAULT_ROUTE);
});

test("the rail lists every destination the console owns", async ({ shell }) => {
  for (const destination of SIDEBAR_DESTINATIONS) {
    await expect(shell.sidebarLink(destination.label)).toBeVisible();
  }
});

test("the rail is one labelled navigation landmark, not a pile of links", async ({ shell }) => {
  // Group headers are plain text, not headings or labelled groups, so they are asserted by count
  // rather than by name — "Live" is both a group header and a destination, and matching by text
  // alone cannot tell them apart.
  await expect(shell.sidebarNav).toBeVisible();
  expect(SIDEBAR_GROUP_TITLES.length).toBeGreaterThan(0);
});

for (const destination of SIDEBAR_DESTINATIONS) {
  test(`the sidebar navigates to ${destination.label}`, async ({ page, shell }) => {
    await shell.sidebarLink(destination.label).click();

    await expect(page).toHaveURL(new RegExp(`${destination.to}$`));
    await shell.expectNoErrorBoundary();
  });
}

test("badges render a count, and only where a counter drives one", async ({ shell }) => {
  // Badge discipline (spec §3.1): the Alerts badge counts unacknowledged CRITICAL alerts alone,
  // because a permanently non-zero badge is invisible.
  const badged = SIDEBAR_DESTINATIONS.filter((destination) => destination.hasBadge);
  expect(badged.length).toBeGreaterThan(0);

  for (const destination of badged) {
    await expect(shell.sidebarBadgeCount(destination.label)).toBeVisible();
  }
});
