import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DataTable, type DataTableColumn } from "./DataTable";

// The desktop queue table exists so an operator can scan a column down the page to find the worst
// problem. That only works if the table is a real table: a screen-reader user navigating by column
// header, and a sighted user reading a row tint, have to reach the same conclusion.

interface Row {
  id: string;
  booking: string;
  provider: string;
  age: string;
  amount: string;
}

const ROWS: Row[] = [
  { id: "B-8823", booking: "#B-8823", provider: "Unassigned", age: "34m", amount: "₹1,499" },
  { id: "B-8811", booking: "#B-8811", provider: "Suresh Mehta", age: "12m", amount: "₹899" },
  { id: "B-8805", booking: "#B-8805", provider: "Ajay V.", age: "4m", amount: "₹2,150" },
];

const COLUMNS: DataTableColumn<Row>[] = [
  { id: "booking", header: "Booking", render: (row) => row.booking },
  { id: "provider", header: "Provider", render: (row) => row.provider },
  { id: "age", header: "Age", numeric: true, render: (row) => row.age },
  { id: "amount", header: "Amount", numeric: true, render: (row) => row.amount },
];

function renderTable(props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  return render(
    <DataTable
      caption="Bookings needing attention"
      columns={COLUMNS}
      rows={ROWS}
      rowKey={(row) => row.id}
      {...props}
    />,
  );
}

describe("structure", () => {
  it("names itself with a caption, so a screen reader announces what the grid is", () => {
    renderTable();

    expect(screen.getByRole("table", { name: "Bookings needing attention" })).toBeInTheDocument();
  });

  it("scopes every header to its column, which is what makes cell-by-cell navigation say the header", () => {
    renderTable();

    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual([
      "Booking",
      "Provider",
      "Age",
      "Amount",
    ]);
    for (const header of headers) {
      expect(header).toHaveAttribute("scope", "col");
    }
  });

  it("renders one row per record and every cell of it", () => {
    renderTable();

    // Header row plus three data rows.
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(screen.getByRole("cell", { name: "Suresh Mehta" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "₹2,150" })).toBeInTheDocument();
  });

  it("marks the numeric columns so ages and amounts stay right-aligned and comparable", () => {
    renderTable();

    expect(screen.getByRole("columnheader", { name: "Age" })).toHaveClass("num");
    expect(screen.getByRole("cell", { name: "34m" })).toHaveClass("num");
    expect(screen.getByRole("columnheader", { name: "Booking" })).not.toHaveClass("num");
  });
});

describe("row tone", () => {
  it("tints a row by severity, so the worst problem is visible before it is read", () => {
    renderTable({
      rowTone: (row) =>
        row.id === "B-8823" ? "danger" : row.id === "B-8811" ? "warning" : "default",
    });

    expect(screen.getByRole("cell", { name: "#B-8823" }).closest("tr")).toHaveClass("row-danger");
    expect(screen.getByRole("cell", { name: "#B-8811" }).closest("tr")).toHaveClass("row-warning");
    expect(screen.getByRole("cell", { name: "#B-8805" }).closest("tr")).not.toHaveClass(
      "row-danger",
      "row-warning",
    );
  });

  it("greys a settled record and fades a merely stale one — they mean different things", () => {
    renderTable({ rowTone: (row) => (row.id === "B-8823" ? "muted" : "faded") });

    expect(screen.getByRole("cell", { name: "#B-8823" }).closest("tr")).toHaveClass("row-muted");
    expect(screen.getByRole("cell", { name: "#B-8811" }).closest("tr")).toHaveClass("row-faded");
  });
});

describe("selection", () => {
  it("marks the open row aria-selected, so the detail pane's owner is announced", () => {
    renderTable({ selectedRowKey: "B-8811" });

    expect(screen.getByRole("cell", { name: "#B-8811" }).closest("tr")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("marks the other rows unselected rather than leaving them undefined", () => {
    renderTable({ selectedRowKey: "B-8811" });

    expect(screen.getByRole("cell", { name: "#B-8823" }).closest("tr")).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("claims no selection at all on a table with no detail pane", () => {
    // A grid where every row says aria-selected="false" implies a selection exists somewhere.
    renderTable();

    expect(screen.getByRole("cell", { name: "#B-8823" }).closest("tr")).not.toHaveAttribute(
      "aria-selected",
    );
  });

  it("opens a row on click when the screen offers a detail pane", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    renderTable({ onRowClick });

    await user.click(screen.getByRole("cell", { name: "#B-8811" }));

    expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);
  });
});

describe("group rows", () => {
  it("spans the group heading across every column, so no column appears to own it", () => {
    renderTable({
      rowGroupLabel: (_row, index) => (index === 0 ? "Today · 20 Jul 2026" : null),
    });

    const heading = screen.getByRole("columnheader", { name: "Today · 20 Jul 2026" });
    // Anything narrower would attach the day to whichever column it happened to land in.
    expect(heading).toHaveAttribute("colspan", String(COLUMNS.length));
    expect(heading).toHaveAttribute("scope", "colgroup");
  });

  it("draws a heading only where the caller returns one", () => {
    renderTable({
      rowGroupLabel: (row) => (row.id === "B-8805" ? "Yesterday · 19 Jul 2026" : null),
    });

    // The four column headers, plus exactly one group heading.
    expect(screen.getAllByRole("columnheader")).toHaveLength(COLUMNS.length + 1);
    expect(
      screen.getByRole("columnheader", { name: "Yesterday · 19 Jul 2026" }),
    ).toBeInTheDocument();
  });
});

describe("the totals row", () => {
  it("lands in a real tfoot, so it is announced as a summary and not as one more record", () => {
    const { container } = renderTable({
      footer: ["Total", "", "", "₹4,548"],
    });

    const tfoot = container.querySelector("tfoot");
    expect(tfoot).not.toBeNull();
    expect(within(tfoot as HTMLElement).getByText("₹4,548")).toBeInTheDocument();
    expect(within(tfoot as HTMLElement).getByText("Total")).toBeInTheDocument();
  });

  it("keeps the numeric alignment of the column each total sits under", () => {
    const { container } = renderTable({ footer: ["Total", "", "", "₹4,548"] });

    const total = within(container.querySelector("tfoot") as HTMLElement).getByText("₹4,548");
    expect(total).toHaveClass("num");
  });

  it("renders no tfoot when the table has no totals", () => {
    const { container } = renderTable();

    expect(container.querySelector("tfoot")).toBeNull();
  });
});

describe("an empty table", () => {
  it("still renders its caption and headers, so the columns explain what is missing", () => {
    render(
      <DataTable
        caption="Bookings needing attention"
        columns={COLUMNS}
        rows={[]}
        rowKey={(row) => row.id}
      />,
    );

    expect(screen.getByRole("table", { name: "Bookings needing attention" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(4);
    expect(screen.getAllByRole("row")).toHaveLength(1);
  });
});
