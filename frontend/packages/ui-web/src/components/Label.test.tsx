import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "./Input";
import { Label } from "./Label";

describe("Label", () => {
  it("associates with its control so the field has an accessible name", () => {
    render(
      <>
        <Label htmlFor="clinic-email">Clinic Email</Label>
        <Input id="clinic-email" />
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Clinic Email" })).toBeInTheDocument();
  });

  it("merges caller classes over the base caption styles", () => {
    render(<Label className="text-ink">Provider</Label>);
    expect(screen.getByText("Provider")).toHaveClass("text-ink");
  });
});
