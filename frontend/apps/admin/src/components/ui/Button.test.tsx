import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Trash2, ArrowRight } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

// `isLoading` is the last line of the duplicate-submission defence: the form's own guard stops a
// second call, and this stops the second click ever happening. It has to disable AND announce, since
// a disabled button that still reads as idle tells a screen-reader user nothing is happening.

describe("Button", () => {
  it("names itself by its own text, the only way an operator finds it", () => {
    render(<Button>Cancel booking</Button>);

    expect(screen.getByRole("button", { name: "Cancel booking" })).toBeInTheDocument();
  });

  it("defaults to type=button, so a secondary action inside a form never submits it", () => {
    render(<Button>Add note</Button>);

    expect(screen.getByRole("button", { name: "Add note" })).toHaveAttribute("type", "button");
  });

  it("submits only when the caller asks it to", () => {
    render(<Button type="submit">Issue refund</Button>);

    expect(screen.getByRole("button", { name: "Issue refund" })).toHaveAttribute("type", "submit");
  });

  it("runs its handler on click", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Assign provider</Button>);

    await user.click(screen.getByRole("button", { name: "Assign provider" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  describe("while loading", () => {
    it("disables itself, so the request in flight cannot be sent a second time", () => {
      render(<Button isLoading>Issue refund</Button>);

      expect(screen.getByRole("button", { name: /Issue refund/ })).toBeDisabled();
    });

    it("announces busy, so the wait is audible and not only visible", () => {
      render(<Button isLoading>Issue refund</Button>);

      expect(screen.getByRole("button", { name: /Issue refund/ })).toHaveAttribute(
        "aria-busy",
        "true",
      );
    });

    it("swallows the click rather than queuing a second refund", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Button isLoading onClick={onClick}>
          Issue refund
        </Button>,
      );

      await user.click(screen.getByRole("button", { name: /Issue refund/ }));

      expect(onClick).not.toHaveBeenCalled();
    });

    it("replaces the start icon with the spinner instead of showing both", () => {
      const { container } = render(
        <Button isLoading iconStart={Trash2}>
          Cancel booking
        </Button>,
      );

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(container.querySelectorAll("svg")).toHaveLength(0);
    });

    it("drops the end icon too, so the button never grows a chevron mid-request", () => {
      const { container } = render(
        <Button isLoading iconEnd={ArrowRight}>
          Next
        </Button>,
      );

      expect(container.querySelectorAll("svg")).toHaveLength(0);
    });
  });

  describe("while idle", () => {
    it("shows the start icon and no spinner", () => {
      const { container } = render(<Button iconStart={Trash2}>Cancel booking</Button>);

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(container.querySelectorAll("svg")).toHaveLength(1);
    });

    it("claims no busy state, so assistive tech is not told to wait for nothing", () => {
      render(<Button>Cancel booking</Button>);

      expect(screen.getByRole("button", { name: "Cancel booking" })).not.toHaveAttribute(
        "aria-busy",
      );
    });
  });

  it("stays disabled when the caller disables it, loading or not", () => {
    render(<Button disabled>Issue refund</Button>);

    expect(screen.getByRole("button", { name: "Issue refund" })).toBeDisabled();
  });

  it("carries its variant and size as classes, because a new look is a variant and never a restyle", () => {
    // P3 restyle: the admin variants now map onto @sethu/ui-web Button token utilities.
    render(
      <Button variant="danger" size="primary" block>
        Cancel booking
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Cancel booking" });
    expect(button).toHaveClass("bg-danger-fg", "h-12", "w-full");
  });

  it("forwards the accessible name a caller sets explicitly, for icon-only buttons", () => {
    render(<Button iconStart={Trash2} aria-label="Remove evidence" />);

    expect(screen.getByRole("button", { name: "Remove evidence" })).toBeInTheDocument();
  });
});
