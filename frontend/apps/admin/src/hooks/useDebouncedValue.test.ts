import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "./useDebouncedValue";

// Search fields feed this instead of the query. The property that matters is that intermediate
// keystrokes are dropped entirely — not merely delayed — so typing "Kompally" is one request.

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value immediately, so the first paint is never blank", () => {
    const { result } = renderHook(() => useDebouncedValue("Kompally"));

    expect(result.current).toBe("Kompally");
  });

  it("withholds a new value until the delay has fully elapsed", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: "K" },
    });

    rerender({ value: "Ko" });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    });
    expect(result.current).toBe("K");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("Ko");
  });

  it("emits only the final value of a burst of keystrokes, never the ones in between", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: "" },
    });

    for (const value of ["K", "Ko", "Kom", "Komp", "Kompally"]) {
      rerender({ value });
      act(() => {
        vi.advanceTimersByTime(50);
      });
    }
    expect(result.current).toBe("");

    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(result.current).toBe("Kompally");
  });

  it("honours a caller's own delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 1_000),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "b" });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 1);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe("b");
  });

  it("debounces any value, not just strings — filters change as objects too", () => {
    const first = { zone: "Kompally" };
    const second = { zone: "Miyapur" };
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: first },
    });

    rerender({ value: second });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });

    expect(result.current).toBe(second);
  });

  it("drops a pending update when the field unmounts, so no timer outlives the screen", () => {
    const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: "K" },
    });

    rerender({ value: "Ko" });
    unmount();

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      });
    }).not.toThrow();
  });
});
