import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TableColumnFilter } from "./TableColumnFilter";

function Harness({ mode }: { mode?: "single" | "multi" }) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <TableColumnFilter
      label="Filter by status"
      mode={mode}
      clearLabel="Clear"
      options={[
        { value: "expired", label: "Expired" },
        { value: "soon", label: "Expiring Soon" },
      ]}
      selected={selected}
      onChange={setSelected}
    />
  );
}

describe("TableColumnFilter", () => {
  it("multi-select keeps the panel open and accumulates selections", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Filter by status" }));
    await userEvent.click(screen.getByRole("option", { name: "Expired" }));
    await userEvent.click(screen.getByRole("option", { name: "Expiring Soon" }));
    expect(screen.getByRole("option", { name: "Expired" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("option", { name: "Expiring Soon" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("clears everything via the clear action", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Filter by status" }));
    await userEvent.click(screen.getByRole("option", { name: "Expired" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    await userEvent.click(screen.getByRole("button", { name: "Filter by status" }));
    expect(screen.getByRole("option", { name: "Expired" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });
});
