import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("exposes a labelled progressbar with the clamped value", () => {
    render(<ProgressBar value={150} label="Stock level" />);
    const bar = screen.getByRole("progressbar", { name: "Stock level" });
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });

  it("shows the formatted visible value when asked", () => {
    render(<ProgressBar value={50} label="Stock level" showValue />);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });
});
