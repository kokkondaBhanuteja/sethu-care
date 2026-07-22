import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchInput } from "./SearchInput";

describe("SearchInput", () => {
  it("hides the clear button while the value is empty", () => {
    render(
      <SearchInput
        aria-label="Search"
        clearLabel="Clear search"
        value=""
        onChange={() => undefined}
      />,
    );
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("shows the clear button once there is a value and fires onClear", async () => {
    const onClear = vi.fn();
    render(
      <SearchInput
        aria-label="Search"
        clearLabel="Clear search"
        value="paracetamol"
        onChange={() => undefined}
        onClear={onClear}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("stays controlled — typing reaches the caller's onChange", async () => {
    const onChange = vi.fn();
    render(
      <SearchInput
        aria-label="Search medicines"
        clearLabel="Clear medicine search"
        value=""
        onChange={onChange}
      />,
    );
    await userEvent.type(screen.getByRole("textbox", { name: "Search medicines" }), "a");
    expect(onChange).toHaveBeenCalledOnce();
  });
});
