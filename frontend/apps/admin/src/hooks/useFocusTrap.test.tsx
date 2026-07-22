import { useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useFocusTrap } from "./useFocusTrap";

// Overlays in this console confirm cancellations and refunds. Tabbing out of one to the page behind
// is how an operator confirms the wrong thing, and losing focus on close is how a keyboard user ends
// up back at the top of a long queue.

interface HarnessProps {
  isOpen: boolean;
  onDismiss: () => void;
}

function Overlay({ isOpen, onDismiss }: HarnessProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, isOpen, onDismiss);

  if (!isOpen) return null;
  return (
    <div ref={containerRef} tabIndex={-1}>
      <button type="button">Cancel booking</button>
      <input aria-label="Reason" />
      <button type="button">Keep booking</button>
    </div>
  );
}

function Harness({ onDismiss = vi.fn() }: { onDismiss?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open
      </button>
      <button type="button" onClick={() => setIsOpen(false)}>
        Close from outside
      </button>
      <Overlay
        isOpen={isOpen}
        onDismiss={() => {
          onDismiss();
          setIsOpen(false);
        }}
      />
    </>
  );
}

describe("useFocusTrap", () => {
  it("moves focus into the overlay on open, so the first Tab is already inside it", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByRole("button", { name: "Cancel booking" })).toHaveFocus();
  });

  it("wraps Tab from the last control back to the first instead of leaving for the page behind", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    screen.getByRole("button", { name: "Keep booking" }).focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(screen.getByRole("button", { name: "Cancel booking" })).toHaveFocus();
  });

  it("wraps Shift+Tab from the first control round to the last", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    screen.getByRole("button", { name: "Cancel booking" }).focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(screen.getByRole("button", { name: "Keep booking" })).toHaveFocus();
  });

  it("leaves Tab alone in the middle of the overlay, where the browser's own order is correct", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    screen.getByLabelText("Reason").focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(screen.getByLabelText("Reason")).toHaveFocus();
  });

  it("dismisses on Escape, the exit every overlay in the console has to offer", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    await user.keyboard("{Escape}");

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("returns focus to whatever opened the overlay, not to the top of the page", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    await user.click(opener);

    await user.keyboard("{Escape}");

    // A keyboard operator who closes a confirm should resume where they were in the queue.
    expect(opener).toHaveFocus();
  });

  it("stays out of the way while the overlay is closed", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);

    await user.keyboard("{Escape}");

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("stops Escape from reaching the screen behind, so one press closes exactly one thing", async () => {
    const user = userEvent.setup();
    const outerEscape = vi.fn();
    document.addEventListener("keydown", outerEscape);
    try {
      render(<Harness />);
      await user.click(screen.getByRole("button", { name: "Open" }));
      outerEscape.mockClear();

      await user.keyboard("{Escape}");

      expect(outerEscape).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("keydown", outerEscape);
    }
  });
});
