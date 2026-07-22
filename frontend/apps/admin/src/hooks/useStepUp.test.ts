import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ACTIONS } from "../lib/permissions/actions";
import { useStepUp } from "./useStepUp";

// Step-up verification is valid for 60 seconds (spec §5.5) — long enough to finish a multi-field
// flow, short enough that a walked-away-from device is never left armed. Both halves of that
// sentence are safety properties, so both are asserted.

describe("useStepUp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not challenge for an action the registry says needs no step-up", async () => {
    const { result } = renderHook(() => useStepUp(ADMIN_ACTIONS.assignProvider));

    expect(result.current.isRequired).toBe(false);
    await act(async () => {
      await expect(result.current.request()).resolves.toBe(true);
    });
    expect(result.current.isChallenging).toBe(false);
  });

  it("challenges for a high-risk action and resolves true once confirmed", async () => {
    const { result } = renderHook(() => useStepUp(ADMIN_ACTIONS.cancelBooking));
    expect(result.current.isRequired).toBe(true);

    let outcome: Promise<boolean> | null = null;
    act(() => {
      outcome = result.current.request();
    });
    expect(result.current.isChallenging).toBe(true);

    act(() => {
      result.current.confirm();
    });
    await expect(outcome).resolves.toBe(true);
    expect(result.current.isChallenging).toBe(false);
  });

  it("resolves false when the operator backs out, so the caller can abort cleanly", async () => {
    const { result } = renderHook(() => useStepUp(ADMIN_ACTIONS.refund));

    let outcome: Promise<boolean> | null = null;
    act(() => {
      outcome = result.current.request();
    });
    act(() => {
      result.current.cancel();
    });

    await expect(outcome).resolves.toBe(false);
    expect(result.current.isChallenging).toBe(false);
  });

  it("skips a second challenge inside the 60-second window", async () => {
    const { result } = renderHook(() => useStepUp(ADMIN_ACTIONS.manualComplete));

    act(() => {
      void result.current.request();
    });
    act(() => {
      result.current.confirm();
    });

    // A four-step flow must not re-prompt between steps 3 and 4.
    act(() => {
      vi.advanceTimersByTime(59_000);
    });
    await act(async () => {
      await expect(result.current.request()).resolves.toBe(true);
    });
    expect(result.current.isChallenging).toBe(false);
  });

  it("challenges again once the window has expired", async () => {
    const { result } = renderHook(() => useStepUp(ADMIN_ACTIONS.manualComplete));

    act(() => {
      void result.current.request();
    });
    act(() => {
      result.current.confirm();
    });

    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    act(() => {
      void result.current.request();
    });

    // The device must not stay armed. This is the assertion that stops someone "optimising" the
    // freshness check away because it felt like friction.
    expect(result.current.isChallenging).toBe(true);
  });
});
