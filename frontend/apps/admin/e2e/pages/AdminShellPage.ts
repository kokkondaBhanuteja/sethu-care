import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The chrome around every authenticated screen. `AdminShell` mounts exactly one of `DesktopShell`
 * (>=768px: the @sethu/ui-web sidebar rail, no tab bar) or `MobileShell` (<768px: five tabs, no
 * sidebar), so the two are told apart by which one is in the DOM at all — never by a CSS
 * breakpoint check.
 *
 * Both shells render a `<nav>` labelled "Primary" — the ui-web Sidebar emits the landmark itself,
 * with no `<aside>` around it — so the two navs are told apart by the one link only the tab bar
 * carries: "More". Desktop has no More menu.
 */
export class AdminShellPage {
  readonly page: Page;
  /** The desktop rail: the "Primary" navigation without the mobile-only More tab. */
  readonly sidebarNav: Locator;
  /** The five-tab bottom bar: the "Primary" navigation that carries the More tab. */
  readonly tabBar: Locator;
  readonly moreTab: Locator;
  /**
   * The sidebar's brand wordmark, matched by TEXT rather than role on purpose: while a Radix modal
   * is open, everything outside the dialog is `aria-hidden` (modality), so no role query can see
   * the rail even though it is fully visible behind the scrim. The text engine ignores
   * `aria-hidden`, so this is the one honest way to assert the rail is still on screen.
   */
  readonly sidebarBrand: Locator;
  readonly fatalError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.moreTab = page.getByRole("link", { name: "More", exact: true });
    const primaryNav = page.getByRole("navigation", { name: "Primary" });
    this.sidebarNav = primaryNav.filter({ hasNot: this.moreTab });
    this.tabBar = primaryNav.filter({ has: this.moreTab });
    this.sidebarBrand = page.getByText("SetuCare", { exact: true });
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
    await expect(this.sidebarNav).toBeHidden();
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
