import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { setViewport } from "../../vitest.setup";
import { useIsDesktop } from "./useBreakpoint";

// 768px is the shell split (spec §2.1). MobileShell and DesktopShell are separate components, so
// this one boolean decides which entire frame an operator gets — including whether the tab bar and
// its one-tap escapes exist at all.

describe("useIsDesktop", () => {
  it.each([320, 390, 767])("reports mobile at %ipx, the phone frame", (width) => {
    setViewport(width);

    expect(renderHook(() => useIsDesktop()).result.current).toBe(false);
  });

  it.each([768, 1024, 1440])("reports desktop from %ipx, where the sidebar rail fits", (width) => {
    setViewport(width);

    expect(renderHook(() => useIsDesktop()).result.current).toBe(true);
  });

  it("treats exactly 768 as desktop, so the split has no dead width between the two shells", () => {
    setViewport(768);
    expect(renderHook(() => useIsDesktop()).result.current).toBe(true);

    setViewport(767);
    expect(renderHook(() => useIsDesktop()).result.current).toBe(false);
  });
});
