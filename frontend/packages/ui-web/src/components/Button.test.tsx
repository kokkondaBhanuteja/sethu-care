import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

describe("Button", () => {
  it("renders an accessible button and fires clicks", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add Provider</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Add Provider" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("defaults type to button so it never submits a form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Suspend
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Suspend" })).catch(() => undefined);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("merges caller classes over variant classes", () => {
    render(<Button className="w-full">Wide</Button>);
    expect(screen.getByRole("button", { name: "Wide" })).toHaveClass("w-full");
  });
});
