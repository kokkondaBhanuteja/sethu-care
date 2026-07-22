import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Input } from "./Input";

describe("Input", () => {
  it("renders a textbox and accepts typed input", async () => {
    const onChange = vi.fn();
    render(<Input aria-label="Search" onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Search" }), "hip");
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("marks the field aria-invalid when the invalid variant is set", () => {
    render(<Input aria-label="Email" invalid />);
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("aria-invalid", "true");
  });

  it("renders leading and trailing slots inside the field box", () => {
    render(
      <Input
        aria-label="Weight"
        leading={<span data-testid="leading-slot" />}
        trailing={<span data-testid="trailing-slot">kg</span>}
      />,
    );
    expect(screen.getByTestId("leading-slot")).toBeInTheDocument();
    expect(screen.getByTestId("trailing-slot")).toBeInTheDocument();
  });

  it("splits styling seams: className hits the box, inputClassName hits the input", () => {
    render(<Input aria-label="City" className="w-full" inputClassName="text-right" />);
    const innerInput = screen.getByRole("textbox", { name: "City" });
    expect(innerInput).toHaveClass("text-right");
    expect(innerInput.parentElement).toHaveClass("w-full");
  });
});
