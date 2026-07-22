import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastHost } from "../components/ui/ToastHost";
import { ADMIN_ACTIONS, type AdminAction } from "../lib/permissions/actions";
import { useToastStore } from "../lib/toast/toastStore";
import { useUndoableAction } from "./useUndoableAction";

// This hook is the only thing standing between the risk register and what an operator is actually
// offered. Getting it wrong in either direction is a product failure: no Undo on a reversible cancel
// wastes ten minutes, and an Undo on a refund is a lie — the gateway has already been called.

afterEach(() => {
  act(() => {
    useToastStore.getState().clear();
  });
});

function announce(action: AdminAction, onUndo = vi.fn()) {
  const { result } = renderHook(() => useUndoableAction(action));
  act(() => {
    result.current({ message: "Booking cancelled", onUndo });
  });
  return { toast: useToastStore.getState().toasts[0], onUndo };
}

describe("actions the register gives an undo window", () => {
  it.each([
    [ADMIN_ACTIONS.cancelBooking, 10_000],
    [ADMIN_ACTIONS.suspendProvider, 10_000],
    [ADMIN_ACTIONS.blockProvider, 10_000],
    [ADMIN_ACTIONS.assignProvider, 30_000],
    [ADMIN_ACTIONS.approveApplication, 30_000],
  ])("offers Undo on %s for exactly the %ims the register allows", (action, windowMs) => {
    const { toast } = announce(action);

    expect(toast?.action?.label).toBe("Undo");
    expect(toast?.durationMs).toBe(windowMs);
    // The draining bar is how the deadline becomes visible rather than merely true.
    expect(toast?.showProgress).toBe(true);
  });

  it("runs the caller's reversal when Undo is taken", () => {
    const { toast, onUndo } = announce(ADMIN_ACTIONS.cancelBooking);

    toast?.action?.onAction();

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("does not reverse anything unless Undo is actually taken", () => {
    const { onUndo } = announce(ADMIN_ACTIONS.cancelBooking);

    expect(onUndo).not.toHaveBeenCalled();
  });

  it("renders the Undo affordance as a real button an operator can reach", () => {
    render(<ToastHost />);
    const { result } = renderHook(() => useUndoableAction(ADMIN_ACTIONS.cancelBooking));

    act(() => {
      result.current({ message: "Booking cancelled", onUndo: vi.fn() });
    });

    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });
});

describe("actions the register gives no undo window", () => {
  it.each([
    ADMIN_ACTIONS.refund,
    ADMIN_ACTIONS.manualComplete,
    ADMIN_ACTIONS.goodwillCredit,
    ADMIN_ACTIONS.rejectApplication,
    ADMIN_ACTIONS.revokeDevice,
  ])("raises a plain confirmation for %s with no Undo attached", (action) => {
    const { toast } = announce(action);

    expect(toast?.message).toBe("Booking cancelled");
    // Asserted as an absence on purpose: the failure mode is an Undo appearing where the effect has
    // already left the building — a gateway call, a customer notification, payout eligibility.
    expect(toast?.action).toBeUndefined();
    expect(toast?.showProgress).toBe(false);
  });

  it("renders no Undo affordance anywhere on screen for a refund", () => {
    render(<ToastHost />);
    const { result } = renderHook(() => useUndoableAction(ADMIN_ACTIONS.refund));

    act(() => {
      result.current({ message: "Refund issued", onUndo: vi.fn() });
    });

    expect(screen.getByText("Refund issued")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("never calls the reversal callback it was handed, even though one was supplied", () => {
    const onUndo = vi.fn();
    announce(ADMIN_ACTIONS.refund, onUndo);

    expect(onUndo).not.toHaveBeenCalled();
  });
});
