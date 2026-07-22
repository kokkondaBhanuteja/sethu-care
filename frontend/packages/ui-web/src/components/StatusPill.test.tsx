import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it("always carries a text label — status is never colour alone", () => {
    render(<StatusPill tone="danger">Due in 3 days</StatusPill>);
    expect(screen.getByText("Due in 3 days")).toBeInTheDocument();
  });

  it("renders the optional icon alongside the label", () => {
    render(
      <StatusPill tone="success" icon={<svg data-testid="pill-icon" />}>
        Paid Via Card
      </StatusPill>,
    );
    expect(screen.getByTestId("pill-icon")).toBeInTheDocument();
    expect(screen.getByText("Paid Via Card")).toBeInTheDocument();
  });
});
