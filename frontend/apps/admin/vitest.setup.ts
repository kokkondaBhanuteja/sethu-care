import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";

import { initI18n } from "@sethu/i18n";

// Tests assert on the copy an operator actually reads, in English — the same rule the E2E specs
// follow. A test that matches a key rather than a string proves nothing about the screen.
beforeAll(() => {
  initI18n("en");
});

// jsdom implements neither matchMedia nor scrollTo. useIsDesktop reads matchMedia on every render,
// so without this every component test throws before it renders anything. Desktop is the default;
// tests that need the mobile shell override it with `setViewport`.
beforeAll(() => {
  vi.stubGlobal(
    "matchMedia",
    (query: string): MediaQueryList =>
      ({
        matches: viewportMatches(query),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
});

let currentWidth = 1440;

function viewportMatches(query: string): boolean {
  const minWidth = /min-width:\s*(\d+)px/.exec(query);
  if (minWidth?.[1]) return currentWidth >= Number(minWidth[1]);
  const maxWidth = /max-width:\s*(\d+)px/.exec(query);
  if (maxWidth?.[1]) return currentWidth <= Number(maxWidth[1]);
  return false;
}

/** Set the width every media query in the test resolves against. 390 = mobile, 1440 = desktop. */
export function setViewport(width: number): void {
  currentWidth = width;
}

afterEach(() => {
  cleanup();
  currentWidth = 1440;
  window.localStorage.clear();
});
