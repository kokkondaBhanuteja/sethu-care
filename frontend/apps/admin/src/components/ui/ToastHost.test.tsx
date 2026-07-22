import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { showToast, TOAST_TONES, useToastStore } from "../../lib/toast/toastStore";
import { ToastHost } from "./ToastHost";

// The host is the only thing that renders a toast, so it is where "Undo fires and the toast goes
// away" is actually observable.

afterEach(() => {
  act(() => {
    useToastStore.getState().clear();
  });
});

describe("ToastHost", () => {
  it("renders nothing at all when there is no toast", () => {
    const { container } = render(<ToastHost />);

    expect(container).toBeEmptyDOMElement();
  });

  it("announces a confirmation politely, so it never interrupts a screen reader mid-sentence", () => {
    render(<ToastHost />);
    act(() => {
      showToast({ message: "Booking cancelled", tone: TOAST_TONES.success });
    });

    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("Booking cancelled");
    expect(toast).toHaveAttribute("aria-live", "polite");
  });

  it("interrupts for a failure, because a refund that did not go through cannot wait its turn", () => {
    render(<ToastHost />);
    act(() => {
      showToast({ message: "The refund could not be issued.", tone: TOAST_TONES.danger });
    });

    const toast = screen.getByRole("alert");
    expect(toast).toHaveAttribute("aria-live", "assertive");
  });

  it("runs the undo callback and clears the toast when the operator takes it", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<ToastHost />);
    act(() => {
      showToast({ message: "Booking cancelled", action: { label: "Undo", onAction } });
    });

    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(onAction).toHaveBeenCalledTimes(1);
    // Leaving it on screen would offer a second Undo for an action that is already reversed.
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("dismisses itself once the window it advertised has elapsed", () => {
    vi.useFakeTimers();
    try {
      render(<ToastHost />);
      act(() => {
        showToast({ message: "Booking cancelled", durationMs: 10_000, action: { label: "Undo", onAction: vi.fn() } });
      });

      act(() => {
        vi.advanceTimersByTime(9_000);
      });
      expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1_500);
      });
      // The undo window has closed, so the affordance must go with it.
      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows only the newest toast, because a stack buries the action it describes", () => {
    render(<ToastHost />);
    act(() => {
      showToast({ message: "Booking cancelled" });
      showToast({ message: "Provider assigned" });
    });

    expect(screen.queryByText("Booking cancelled")).not.toBeInTheDocument();
    expect(screen.getByText("Provider assigned")).toBeInTheDocument();
  });
});
