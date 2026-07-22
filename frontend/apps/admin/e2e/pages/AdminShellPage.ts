import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The chrome around every authenticated screen. `AdminShell` mounts exactly one of `DesktopShell`
 * (>=768px: a 240px sidebar, no tab bar) or `MobileShell` (<768px: five tabs, no sidebar), so the
 * two are told apart by which one is in the DOM at all — never by a CSS breakpoint check.
 */
export class AdminShellPage {
  readonly page: Page;
  /** `<aside class="sidebar">` — desktop only. */
  readonly sidebar: Locator;
  /** Both shells label their nav "Primary"; only the sidebar's sits inside the complementary. */
  readonly sidebarNav: Locator;
  /** The five-tab bottom bar. "More" exists only there — desktop has no More menu. */
  readonly tabBar: Locator;
  readonly moreTab: Locator;
  readonly fatalError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.getByRole("complementary");
    this.sidebarNav = this.sidebar.getByRole("navigation", { name: "Primary" });
    this.tabBar = page.getByRole("navigation", { name: "Primary" });
    this.moreTab = page.getByRole("link", { name: "More", exact: true });
    this.fatalError = page.getByRole("heading", { name: "This screen failed to load" });
  }

  /** Nothing on a route may land on the RouteErrorBoundary — that is a crash, not a state. */
  async expectNoErrorBoundary(): Promise<void> {
    await expect(this.fatalError).toBeHidden();
  }

  async expectDesktopShell(): Promise<void> {
    await expect(this.sidebarNav).toBeVisible();
    await expect(this.moreTab).toBeHidden();
  }

  async expectMobileShell(): Promise<void> {
    await expect(this.sidebar).toBeHidden();
    await expect(this.moreTab).toBeVisible();
  }

  /**
   * A badged item carries an sr-only "<count> <label>" beside its visible label, so its accessible
   * name is the label twice over. Match from the start rather than exactly, and let the badge test
   * assert the count itself.
   */
  sidebarLink(name: string): Locator {
    return this.sidebarNav.getByRole("link", {
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    });
  }

  /** The count the badge draws. `aria-hidden`, because the sr-only label carries it for AT. */
  sidebarBadgeCount(name: string): Locator {
    return this.sidebarLink(name).getByText(/^\d+$/);
  }

  /** No screen may make the page scroll sideways at any width (spec §2.1). */
  async expectNoHorizontalScroll(): Promise<void> {
    const overflow = await this.page.evaluate(
      () => document.body.scrollWidth - document.body.clientWidth,
    );
    expect(overflow, "document.body.scrollWidth exceeds clientWidth").toBeLessThanOrEqual(0);
  }
}
