import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { StatusPill } from "./StatusPill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./Table";
import { TableColumnFilter } from "./TableColumnFilter";

// The header caret filter from the reference tables: a small panel of options beside the column
// label, single- or multi-select, with an optional Clear foot.
const meta = {
  title: "UI/TableColumnFilter",
  component: TableColumnFilter,
  tags: ["autodocs"],
  args: {
    label: "Filter by status",
    options: [],
    selected: [],
    onChange: () => undefined,
  },
} satisfies Meta<typeof TableColumnFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

function InHeaderDemo() {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <Table className="w-[32rem]">
      <TableHeader>
        <TableRow>
          <TableHead>Medicine</TableHead>
          <TableHead>
            <span className="inline-flex items-center gap-1">
              Status
              <TableColumnFilter
                label="Filter by status"
                clearLabel="Clear"
                options={[
                  { value: "expired", label: "Expired" },
                  { value: "expiring6", label: "Expiring in 6M" },
                  { value: "expiring12", label: "Expiring in 12M" },
                ]}
                selected={selected}
                onChange={setSelected}
              />
            </span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Paracetamol 500mg</TableCell>
          <TableCell>
            <StatusPill tone="danger">Expired</StatusPill>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

export const InTableHeader: Story = { render: () => <InHeaderDemo /> };
