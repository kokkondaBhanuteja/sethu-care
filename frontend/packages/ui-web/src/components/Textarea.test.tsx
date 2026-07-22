import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Textarea } from "./Textarea";

describe("Textarea", () => {
  it("renders a multiline textbox and accepts typed input", async () => {
    const onChange = vi.fn();
    render(<Textarea aria-label="Visit Notes" onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Visit Notes" }), "ok");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("marks the field aria-invalid when the invalid variant is set", () => {
    render(<Textarea aria-label="Notes" invalid />);
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveAttribute("aria-invalid", "true");
  });

  it("merges caller classes over variant classes", () => {
    render(<Textarea aria-label="Care Plan" className="min-h-40" />);
    expect(screen.getByRole("textbox", { name: "Care Plan" })).toHaveClass("min-h-40");
  });
});
