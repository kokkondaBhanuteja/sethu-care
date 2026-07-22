import { Fragment, type ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@sethu/ui-web";

import type { DataTableProps } from "./data-table.types";

export type { DataTableColumn, DataTableProps } from "./data-table.types";

/** Numeric columns: right-aligned tabular figures so amounts and ages compare down the column. */
const NUMERIC_CLASSES = "text-right tabular-nums";

/** rowTone → tinted row classes, straight from the global tone tokens. */
const ROW_TONE_CLASSES = {
  default: "",
  danger: "bg-danger-bg",
  warning: "bg-warning-bg",
  muted: "text-muted",
  faded: "opacity-60",
} as const;

/**
 * Reimplemented on the @sethu/ui-web Table anatomy (P3 migration): uppercase muted headers, airy
 * hairline rows, hover, overflow-x scroll — while the column-config API is unchanged so no feature
 * churns. Mobile stacks the same records into cards instead; this table is the desktop scan view.
 */
export function DataTable<TRow>({
  caption,
  columns,
  rows,
  rowKey,
  rowTone,
  onRowClick,
  selectedRowKey = null,
  rowGroupLabel,
  density = "default",
  tight = false,
  footer,
  className,
}: DataTableProps<TRow>) {
  const cellPadding = tight ? "px-2" : undefined;

  return (
    <Table density={density === "dense" ? "compact" : "default"} className={className}>
      <caption className="sr-only">{caption}</caption>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.id}
              scope="col"
              className={cn(cellPadding, column.numeric && NUMERIC_CLASSES, column.headerClassName)}
            >
              {column.filter ? (
                <span className="inline-flex items-center gap-1">
                  {column.header}
                  {column.filter}
                </span>
              ) : (
                column.header
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const key = rowKey(row);
          const groupLabel = rowGroupLabel?.(row, index) ?? null;
          return (
            <Fragment key={key}>
              {groupLabel ? (
                <TableRow className="bg-inset">
                  <th
                    scope="colgroup"
                    colSpan={columns.length}
                    className={cn(
                      "px-4 py-2 text-left text-table-head font-medium uppercase tracking-wider text-faint",
                      cellPadding,
                    )}
                  >
                    {groupLabel}
                  </th>
                </TableRow>
              ) : null}
              <TableRow
                aria-selected={selectedRowKey === null ? undefined : selectedRowKey === key}
                className={cn(
                  density === "roomy" && "[&>td]:py-5",
                  ROW_TONE_CLASSES[rowTone?.(row) ?? "default"],
                  selectedRowKey === key && "bg-info-bg",
                  onRowClick && "cursor-pointer",
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn(
                      cellPadding,
                      column.numeric && NUMERIC_CLASSES,
                      column.cellClassName,
                    )}
                  >
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            </Fragment>
          );
        })}
      </TableBody>
      {footer ? (
        <tfoot>
          <TableRow className="border-t border-border font-semibold">
            {footer.map((cell, cellIndex) => (
              <TableCell
                key={columns[cellIndex]?.id ?? cellIndex}
                className={cn(cellPadding, columns[cellIndex]?.numeric && NUMERIC_CLASSES)}
              >
                {cell}
              </TableCell>
            ))}
          </TableRow>
        </tfoot>
      ) : null}
    </Table>
  );
}

/** Groups the small outline buttons the design puts in a table's trailing Actions column. */
export function TableActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-2">{children}</div>;
}
