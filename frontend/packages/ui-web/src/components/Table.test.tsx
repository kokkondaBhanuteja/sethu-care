import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  Table,
  TableActionLink,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./Table";

// The workspace vitest setup registers no RTL auto-cleanup (no `globals: true`), so unmount
// explicitly — a stale open overlay would otherwise leak `pointer-events: none` across tests.
afterEach(cleanup);

describe("Table", () => {
  it("renders semantic table anatomy", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>INV-2041</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Invoice" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "INV-2041" })).toBeInTheDocument();
  });

  it("wraps the table in a horizontal scroll container for narrow screens", () => {
    render(<Table data-testid="invoice-table" />);
    expect(screen.getByTestId("invoice-table").parentElement).toHaveClass("overflow-x-auto");
  });

  it("applies the compact density axis on the table element", () => {
    render(<Table density="compact" data-testid="invoice-table" />);
    expect(screen.getByTestId("invoice-table")).toHaveClass("[&_td]:py-2.5");
  });
});

describe("TableActionLink", () => {
  it("defaults to an anchor and keeps the chevron decorative", () => {
    render(<TableActionLink href="/invoices/2041">View &amp; Edit</TableActionLink>);
    const actionLink = screen.getByRole("link", { name: "View & Edit" });
    expect(actionLink).toHaveAttribute("href", "/invoices/2041");
  });

  it("renders through the app's router link via `as` with full prop passthrough", () => {
    interface RouterLinkStubProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
      to: string;
      children?: ReactNode;
    }
    function RouterLinkStub({ to, children, ...props }: RouterLinkStubProps) {
      return (
        <a href={to} {...props}>
          {children}
        </a>
      );
    }
    render(
      <TableActionLink as={RouterLinkStub} to="/invoices/2041">
        View
      </TableActionLink>,
    );
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute("href", "/invoices/2041");
  });
});
