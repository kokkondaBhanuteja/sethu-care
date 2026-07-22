import type { Meta, StoryObj } from "@storybook/react-vite";

import { StatusPill } from "./StatusPill";
import {
  Table,
  TableActionLink,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./Table";

// The Figma #8 invoice table: uppercase faint captions, airy rows, tinted status pills, blue
// link+chevron action cells, all inside a horizontal scroll wrapper for narrow screens.
const meta = {
  title: "UI/Table",
  component: Table,
  tags: ["autodocs"],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const INVOICE_ROWS = [
  ["INV-2041", "Lakshmi Traders", "₹12,400", "success", "Paid Via Card"],
  ["INV-2042", "Sri Venkata Agencies", "₹8,150", "warning", "Due in 10 Days"],
  ["INV-2043", "Ravi Medical Stores", "₹21,900", "danger", "Due in 3 days"],
] as const;

function InvoiceTable({ density }: { density?: "default" | "compact" }) {
  return (
    <Table density={density} className="min-w-lg">
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {INVOICE_ROWS.map(([invoiceNumber, customerName, amount, tone, statusLabel]) => (
          <TableRow key={invoiceNumber}>
            <TableCell className="font-medium">{invoiceNumber}</TableCell>
            <TableCell>
              {customerName}
              <div className="text-xs text-muted">Wholesale</div>
            </TableCell>
            <TableCell>{amount}</TableCell>
            <TableCell>
              <StatusPill tone={tone}>{statusLabel}</StatusPill>
            </TableCell>
            <TableCell className="text-right">
              <TableActionLink href="#view">View &amp; Edit</TableActionLink>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export const Invoices: Story = {
  render: () => (
    <div className="w-4xl max-w-full rounded-card border border-border bg-surface p-2 shadow-card">
      <InvoiceTable />
    </div>
  ),
};

export const Compact: Story = {
  render: () => (
    <div className="w-4xl max-w-full rounded-card border border-border bg-surface p-2 shadow-card">
      <InvoiceTable density="compact" />
    </div>
  ),
};

export const InsetHeader: Story = {
  render: () => (
    <div className="w-4xl max-w-full overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <Table>
        <TableHeader look="inset">
          <TableRow>
            <TableHead>Provider</TableHead>
            <TableHead>Bookings</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Anitha Home Care</TableCell>
            <TableCell>32</TableCell>
            <TableCell className="text-right">
              <TableActionLink href="#view">View</TableActionLink>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  ),
};
