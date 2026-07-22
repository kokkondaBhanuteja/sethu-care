import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";
import { Drawer } from "./Drawer";
import { Modal } from "./Modal";
import { Sheet } from "./Sheet";

// Modals in this console confirm cancellations, refunds and manual completions. Every property here
// is about not confirming the wrong thing: the overlay has to be announced as blocking, be named by
// what it is about, hold focus, and offer exactly one way out — or none, once the request is away.

describe("Modal", () => {
  it("renders nothing while closed, so a closed confirm cannot be tabbed into", () => {
    const { container } = render(
      <Modal isOpen={false} title="Cancel booking #B-8823" onDismiss={vi.fn()}>
        <p>This cannot be undone after ten seconds.</p>
      </Modal>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("announces itself as a blocking dialog named by its title", () => {
    render(
      <Modal isOpen title="Cancel booking #B-8823" onDismiss={vi.fn()}>
        <p>Body</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Cancel booking #B-8823" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("describes itself with its subtitle, so the stakes are read with the question", () => {
    render(
      <Modal
        isOpen
        title="Cancel booking #B-8823"
        subtitle="The customer is refunded ₹1,499 and the provider is notified."
        onDismiss={vi.fn()}
      >
        <p>Body</p>
      </Modal>,
    );

    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      "The customer is refunded ₹1,499 and the provider is notified.",
    );
  });

  it("pulls focus inside on open, so the first keystroke goes to the confirm and not the page", () => {
    render(
      <Modal
        isOpen
        title="Cancel booking #B-8823"
        onDismiss={vi.fn()}
        footer={<Button variant="danger">Confirm cancellation</Button>}
      >
        <p>Body</p>
      </Modal>,
    );

    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("dismisses on Escape", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Modal isOpen title="Cancel booking #B-8823" onDismiss={onDismiss}>
        <p>Body</p>
      </Modal>,
    );

    await user.keyboard("{Escape}");

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses on the close button", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Modal isOpen title="Cancel booking #B-8823" onDismiss={onDismiss}>
        <p>Body</p>
      </Modal>,
    );

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses on the scrim, the design's tap-outside exit", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const { container } = render(
      <Modal isOpen title="Cancel booking #B-8823" onDismiss={onDismiss}>
        <p>Body</p>
      </Modal>,
    );

    await user.click(container.querySelector(".modal-scrim") as HTMLElement);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("keeps a click inside the dialog from reaching the scrim", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Modal isOpen title="Cancel booking #B-8823" onDismiss={onDismiss}>
        <p>Body text</p>
      </Modal>,
    );

    await user.click(screen.getByText("Body text"));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  describe("once the flow has committed (isDismissable={false})", () => {
    it("offers no close affordance at all", () => {
      render(
        <Modal isOpen title="Issuing refund" isDismissable={false} onDismiss={vi.fn()}>
          <p>Body</p>
        </Modal>,
      );

      // Asserted as an absence: a stray click on an X mid-request abandons a half-committed action.
      expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    });

    it("ignores Escape", async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <Modal isOpen title="Issuing refund" isDismissable={false} onDismiss={onDismiss}>
          <p>Body</p>
        </Modal>,
      );

      await user.keyboard("{Escape}");

      expect(onDismiss).not.toHaveBeenCalled();
    });

    it("ignores a click on the scrim", async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const { container } = render(
        <Modal isOpen title="Issuing refund" isDismissable={false} onDismiss={onDismiss}>
          <p>Body</p>
        </Modal>,
      );

      await user.click(container.querySelector(".modal-scrim") as HTMLElement);

      expect(onDismiss).not.toHaveBeenCalled();
    });

    it("still shows the dialog and its content", () => {
      render(
        <Modal isOpen title="Issuing refund" isDismissable={false} onDismiss={vi.fn()}>
          <p>Do not close this window.</p>
        </Modal>,
      );

      expect(screen.getByRole("dialog", { name: "Issuing refund" })).toBeInTheDocument();
      expect(screen.getByText("Do not close this window.")).toBeInTheDocument();
    });
  });

  it("renders the footer actions the caller supplies", () => {
    render(
      <Modal
        isOpen
        title="Cancel booking #B-8823"
        onDismiss={vi.fn()}
        footer={<Button variant="danger">Confirm cancellation</Button>}
      >
        <p>Body</p>
      </Modal>,
    );

    expect(screen.getByRole("button", { name: "Confirm cancellation" })).toBeInTheDocument();
  });
});

describe("Drawer", () => {
  it("renders nothing while closed", () => {
    const { container } = render(
      <Drawer isOpen={false} title="Filters" onDismiss={vi.fn()}>
        <p>Body</p>
      </Drawer>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("announces as a dialog named by its title", () => {
    render(
      <Drawer isOpen title="Audit entry" onDismiss={vi.fn()}>
        <p>Body</p>
      </Drawer>,
    );

    const dialog = screen.getByRole("dialog", { name: "Audit entry" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("traps focus on open", () => {
    render(
      <Drawer isOpen title="Audit entry" onDismiss={vi.fn()}>
        <p>Body</p>
      </Drawer>,
    );

    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("dismisses on Escape and on its close button", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Drawer isOpen title="Audit entry" onDismiss={onDismiss}>
        <p>Body</p>
      </Drawer>,
    );

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it("renders its footer actions", () => {
    render(
      <Drawer isOpen title="Filters" onDismiss={vi.fn()} footer={<Button>Apply</Button>}>
        <p>Body</p>
      </Drawer>,
    );

    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
  });
});

describe("Sheet", () => {
  it("renders nothing while closed", () => {
    const { container } = render(
      <Sheet isOpen={false} title="Filter bookings" onDismiss={vi.fn()}>
        <p>Body</p>
      </Sheet>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("announces as a dialog named by its title", () => {
    render(
      <Sheet isOpen title="Filter bookings" onDismiss={vi.fn()}>
        <p>Body</p>
      </Sheet>,
    );

    const dialog = screen.getByRole("dialog", { name: "Filter bookings" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("keeps its title available to assistive tech even when it is hidden visually", () => {
    render(
      <Sheet isOpen title="Filter bookings" hideTitle onDismiss={vi.fn()}>
        <p>Body</p>
      </Sheet>,
    );

    // hideTitle hides the heading from sight, never from the accessibility tree.
    expect(screen.getByRole("dialog", { name: "Filter bookings" })).toBeInTheDocument();
  });

  it("dismisses on Escape", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Sheet isOpen title="Filter bookings" onDismiss={onDismiss}>
        <p>Body</p>
      </Sheet>,
    );

    await user.keyboard("{Escape}");

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses on the scrim, the design's tap-outside exit", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const { container } = render(
      <Sheet isOpen title="Filter bookings" onDismiss={onDismiss}>
        <p>Body</p>
      </Sheet>,
    );

    await user.click(container.querySelector(".scrim") as HTMLElement);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("traps focus on the first control inside it", () => {
    render(
      <Sheet isOpen title="Filter bookings" onDismiss={vi.fn()} footer={<Button>Apply</Button>}>
        <button type="button">Clear all</button>
      </Sheet>,
    );

    expect(screen.getByRole("button", { name: "Clear all" })).toHaveFocus();
  });
});
