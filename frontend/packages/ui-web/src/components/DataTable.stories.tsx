import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pill, ShoppingCart, Target } from "lucide-react";

import { Card, CardFooter } from "./Card";
import { DataTable, type DataTableColumn } from "./DataTable";
import { DataTableViewOptions } from "./DataTableViewOptions";
import { IconChip } from "./IconChip";
import { Pagination } from "./Pagination";
import { ProgressBar } from "./ProgressBar";
import { TableColumnFilter } from "./TableColumnFilter";

// The reference table, recreated: icon mini-chips on headers, sortable columns, a header-caret
// filter, progress-bar cells, and the card-footer pager. Everything is composition.
interface Stock {
  id: string;
  medicine: string;
  quantity: number;
  threshold: number;
  level: number;
}

const ROWS: Stock[] = [
  { id: "1", medicine: "Paracetamol 500mg", quantity: 32, threshold: 32, level: 95 },
  { id: "2", medicine: "Amoxicillin 250mg", quantity: 100, threshold: 100, level: 88 },
  { id: "3", medicine: "Amoxicillin 250mg", quantity: 500, threshold: 500, level: 50 },
];

const headerChip = (icon: React.ReactNode) => (
  <IconChip
    size="sm"
    look="solid"
    accent="brand"
    className="size-6 rounded-md bg-ink [&_svg]:size-3.5"
  >
    {icon}
  </IconChip>
);

const stockTone = (value: number) => (value < 60 ? "danger" : value < 90 ? "warning" : "success");

const meta = {
  title: "UI/DataTable",
  component: DataTable,
  tags: ["autodocs"],
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

function StockTableDemo() {
  const [hidden, setHidden] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const columns: DataTableColumn<Stock>[] = [
    {
      id: "medicine",
      header: "Medicine",
      icon: headerChip(<Pill />),
      cell: (row) => row.medicine,
      hideable: false,
    },
    {
      id: "quantity",
      header: "Qty",
      icon: headerChip(<ShoppingCart />),
      sortable: true,
      sortValue: (row) => row.quantity,
      cell: (row) => row.quantity,
    },
    {
      id: "threshold",
      header: "Threshold Qty",
      icon: headerChip(<ShoppingCart />),
      sortable: true,
      sortValue: (row) => row.threshold,
      cell: (row) => row.threshold,
    },
    {
      id: "status",
      header: "Stock Status",
      icon: headerChip(<Target />),
      headerExtra: (
        <TableColumnFilter
          label="Filter stock status"
          mode="single"
          clearLabel="Clear"
          options={[
            { value: "low", label: "Low to Safe Stock" },
            { value: "safe", label: "Safe to Low" },
          ]}
          selected={statusFilter}
          onChange={setStatusFilter}
        />
      ),
      cell: (row) => (
        <ProgressBar
          value={row.level}
          label="Stock level"
          toneFor={stockTone}
          showValue
          className="min-w-40"
        />
      ),
    },
  ];

  return (
    <Card className="w-[56rem] max-w-full">
      <DataTable
        columns={columns}
        rows={ROWS}
        rowKey={(row) => row.id}
        hiddenColumns={hidden}
        sortLabel={(columnId) => `Sort by ${columnId}`}
      />
      <CardFooter className="justify-center gap-4">
        <span className="text-sm text-muted">Page {page} of 3</span>
        <Pagination
          aria-label="Table pages"
          page={page}
          pageCount={3}
          onPageChange={setPage}
          labels={{
            first: "First",
            previous: "Previous",
            next: "Next",
            last: "Last",
            page: (n) => `Page ${n}`,
          }}
        />
        <DataTableViewOptions
          columns={columns}
          hiddenColumns={hidden}
          onHiddenColumnsChange={setHidden}
          label="Columns"
        />
      </CardFooter>
    </Card>
  );
}

export const ReferenceRecreation: Story = {
  args: { columns: [], rows: [], rowKey: () => "" },
  render: () => <StockTableDemo />,
};
