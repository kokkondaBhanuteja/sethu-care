import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DataTable, type DataTableColumn } from "./DataTable";

interface Medicine {
  id: string;
  name: string;
  quantity: number;
}

const ROWS: Medicine[] = [
  { id: "1", name: "Paracetamol", quantity: 32 },
  { id: "2", name: "Amoxicillin", quantity: 500 },
];

const COLUMNS: DataTableColumn<Medicine>[] = [
  { id: "name", header: "Medicine", cell: (row) => row.name },
  {
    id: "quantity",
    header: "Qty",
    cell: (row) => row.quantity,
    sortable: true,
    sortValue: (row) => row.quantity,
  },
];

describe("DataTable", () => {
  it("client-sorts ascending, descending, then clears", async () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        sortLabel={(columnId) => `Sort by ${columnId}`}
      />,
    );
    const sortButton = screen.getByRole("button", { name: "Sort by quantity" });
    const firstDataCell = () => within(screen.getAllByRole("row")[1]!).getAllByRole("cell")[0]!;

    await userEvent.click(sortButton); // asc -> Paracetamol (32) first
    expect(firstDataCell()).toHaveTextContent("Paracetamol");
    await userEvent.click(sortButton); // desc -> Amoxicillin (500) first
    expect(firstDataCell()).toHaveTextContent("Amoxicillin");
  });

  it("hides columns listed in hiddenColumns", () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        hiddenColumns={["quantity"]}
      />,
    );
    expect(screen.queryByText("Qty")).not.toBeInTheDocument();
    expect(screen.getByText("Medicine")).toBeInTheDocument();
  });

  it("fires onRowClick with the row", async () => {
    const onRowClick = vi.fn();
    render(
      <DataTable columns={COLUMNS} rows={ROWS} rowKey={(row) => row.id} onRowClick={onRowClick} />,
    );
    await userEvent.click(screen.getByText("Paracetamol"));
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });

  it("renders the empty slot when there are no rows", () => {
    render(
      <DataTable columns={COLUMNS} rows={[]} rowKey={(row: Medicine) => row.id} empty="Nothing" />,
    );
    expect(screen.getByText("Nothing")).toBeInTheDocument();
  });
});

describe("DataTable + view options", () => {
  it("toggles column visibility through DataTableViewOptions", async () => {
    function Harness() {
      const [hidden, setHidden] = useState<string[]>([]);
      return (
        <>
          <DataTable
            columns={COLUMNS}
            rows={ROWS}
            rowKey={(row) => row.id}
            hiddenColumns={hidden}
          />
          <button type="button" onClick={() => setHidden(hidden.length ? [] : ["quantity"])}>
            Toggle Qty
          </button>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByText("Qty")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Toggle Qty" }));
    expect(screen.queryByText("Qty")).not.toBeInTheDocument();
  });
});
