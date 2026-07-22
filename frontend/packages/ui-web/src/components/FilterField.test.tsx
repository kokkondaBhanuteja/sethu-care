import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FilterBand, FilterField } from "./FilterField";
import { Input } from "./Input";

describe("FilterField", () => {
  it("labels the control it wraps via htmlFor", () => {
    render(
      <FilterField label="City" htmlFor="filter-city">
        <Input id="filter-city" />
      </FilterField>,
    );
    expect(screen.getByRole("textbox", { name: "City" })).toBeInTheDocument();
  });
});

describe("FilterBand", () => {
  it("renders children plus the actions slot", () => {
    render(
      <FilterBand actions={<button type="button">Show All</button>}>
        <FilterField label="Search">
          <Input aria-label="Search" />
        </FilterField>
      </FilterBand>,
    );
    expect(screen.getByRole("textbox", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show All" })).toBeInTheDocument();
  });

  it("lets callers reshape the grid through className", () => {
    const { container } = render(<FilterBand className="xl:grid-cols-4" />);
    expect(container.firstElementChild).toHaveClass("xl:grid-cols-4");
  });
});
