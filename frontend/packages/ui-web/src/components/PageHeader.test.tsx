import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renders exactly one h1 with the title and the actions slot", () => {
    render(<PageHeader title="Bookings" actions={<button type="button">New</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Bookings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });
});
