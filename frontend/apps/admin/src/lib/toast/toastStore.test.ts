import { afterEach, describe, expect, it, vi } from "vitest";

import { showToast, TOAST_TONES, useToastStore } from "./toastStore";

// The store holds the undo windows from the risk register, so it has to outlive the component that
// started the action — a cancel toast must survive the operator navigating away from the booking.

afterEach(() => {
  useToastStore.getState().clear();
});

function toasts() {
  return useToastStore.getState().toasts;
}

describe("one toast at a time", () => {
  it("replaces the visible toast rather than stacking a second one", () => {
    // Stacked toasts sit over the mobile action bar and bury the button they describe (spec §3.3).
    showToast({ message: "Booking cancelled" });
    showToast({ message: "Provider assigned" });

    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]?.message).toBe("Provider assigned");
  });

  it("gives every toast a distinct id, so dismissing one never dismisses its successor", () => {
    const first = showToast({ message: "Booking cancelled" });
    const second = showToast({ message: "Provider assigned" });

    expect(first).not.toBe(second);
    useToastStore.getState().dismiss(first);
    expect(toasts()).toHaveLength(1);
  });
});

describe("defaults", () => {
  it("dwells for four seconds and reads as info when the caller says nothing", () => {
    showToast({ message: "Filters cleared" });

    expect(toasts()[0]).toMatchObject({ tone: TOAST_TONES.info, durationMs: 4_000 });
  });

  it("draws the draining progress bar for any toast carrying an action", () => {
    // The bar IS the deadline: an Undo with no visible countdown is a promise with no stated expiry.
    showToast({ message: "Booking cancelled", action: { label: "Undo", onAction: vi.fn() } });

    expect(toasts()[0]?.showProgress).toBe(true);
  });

  it("draws no progress bar on a plain confirmation, which has no deadline to show", () => {
    showToast({ message: "Refund issued", tone: TOAST_TONES.success });

    expect(toasts()[0]?.showProgress).toBe(false);
  });

  it("honours an explicit duration, which is how the 10s and 30s undo windows arrive", () => {
    showToast({ message: "Provider suspended", durationMs: 10_000 });

    expect(toasts()[0]?.durationMs).toBe(10_000);
  });
});

describe("the undo action", () => {
  it("carries the caller's callback through untouched", () => {
    const onAction = vi.fn();
    showToast({ message: "Booking cancelled", action: { label: "Undo", onAction } });

    toasts()[0]?.action?.onAction();

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("dismisses by id, leaving nothing behind for the host to re-render", () => {
    const id = showToast({ message: "Booking cancelled" });

    useToastStore.getState().dismiss(id);

    expect(toasts()).toHaveLength(0);
  });

  it("ignores a dismiss for a toast that has already gone", () => {
    const id = showToast({ message: "Booking cancelled" });
    useToastStore.getState().dismiss(id);

    expect(() => useToastStore.getState().dismiss(id)).not.toThrow();
    expect(toasts()).toHaveLength(0);
  });
});

describe("the non-hook accessor", () => {
  it("raises a toast from outside React, which is how the mutation-error bridge reports a failure", () => {
    const id = showToast({ message: "The refund could not be issued.", tone: TOAST_TONES.danger });

    expect(toasts()[0]).toMatchObject({ id, tone: TOAST_TONES.danger });
  });
});
