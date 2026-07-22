import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Combobox, type ComboboxOption } from "./Combobox";

const OPTIONS: ComboboxOption[] = [
  { value: "a", label: "Suresh Mehta" },
  { value: "b", label: "Kiran Rao" },
];

function Harness() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <Combobox
      options={OPTIONS}
      value={value}
      onChange={setValue}
      placeholder="Select a provider"
      searchPlaceholder="Search"
      emptyText="No match"
    />
  );
}

describe("Combobox", () => {
  it("opens, filters by the search box, and selects an option", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.type(screen.getByPlaceholderText("Search"), "kiran");
    expect(screen.queryByText("Suresh Mehta")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: /Kiran Rao/ }));
    expect(screen.getByRole("combobox")).toHaveTextContent("Kiran Rao");
  });

  it("shows the empty text when nothing matches", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.type(screen.getByPlaceholderText("Search"), "zzz");
    expect(screen.getByText("No match")).toBeInTheDocument();
  });
});
