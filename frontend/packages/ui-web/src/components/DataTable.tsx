import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "../lib/cn";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./Table";

// The generic data table: typed column config over the Table anatomy. Sorting is controlled
// (server-side: pass sort + onSortChange) or client-side (give a column sortValue and omit
// onSortChange); column visibility pairs with <DataTableViewOptions>. Header-caret filters slot in
// per column via `headerExtra` (compose <TableColumnFilter>). Rendering stays fully mouldable:
// every cell is a render prop, every label arrives from the caller (apps localize).

export type SortDirection = "asc" | "desc";
export interface DataTableSort {
  columnId: string;
  direction: SortDirection;
}

export interface DataTableColumn<TRow> {
  id: string;
  header: ReactNode;
  /** Leading header icon (the reference's column mini-chips) — decorative, aria-hidden by the caller. */
  icon?: ReactNode;
  cell: (row: TRow) => ReactNode;
  /** Enables the header sort button. Client-side sort additionally needs `sortValue`. */
  sortable?: boolean;
  /** Accessor for internal client-side sorting (ignored when `onSortChange` is provided). */
  sortValue?: (row: TRow) => string | number;
  /** Extra header content — a <TableColumnFilter>, a unit hint… */
  headerExtra?: ReactNode;
  /** Can be hidden via DataTableViewOptions. Default true. */
  hideable?: boolean;
  align?: "left" | "right";
  headClassName?: string;
  cellClassName?: string;
}

export interface DataTableProps<TRow> {
  columns: readonly DataTableColumn<TRow>[];
  rows: readonly TRow[];
  rowKey: (row: TRow) => string;
  /** Controlled sort state; omit for uncontrolled (internal) client-side sorting. */
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort | null) => void;
  /** Accessible label pattern for sort buttons, e.g. (h) => `Sort by ${h}`. */
  sortLabel?: (columnId: string) => string;
  /** Hidden column ids (pair with DataTableViewOptions). */
  hiddenColumns?: readonly string[];
  onRowClick?: (row: TRow) => void;
  empty?: ReactNode;
  density?: "default" | "compact";
  className?: string;
}

export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  sort: controlledSort,
  onSortChange,
  sortLabel,
  hiddenColumns = [],
  onRowClick,
  empty,
  density,
  className,
}: DataTableProps<TRow>) {
  const [internalSort, setInternalSort] = useState<DataTableSort | null>(null);
  const sort = controlledSort !== undefined ? controlledSort : internalSort;
  const setSort = onSortChange ?? setInternalSort;

  const visibleColumns = columns.filter((column) => !hiddenColumns.includes(column.id));

  const sortedRows = useMemo(() => {
    if (!sort || onSortChange) return rows; // server-sorted (or unsorted): render as given
    const column = columns.find((candidate) => candidate.id === sort.columnId);
    if (!column?.sortValue) return rows;
    const accessor = column.sortValue;
    return [...rows].sort((left, right) => {
      const a = accessor(left);
      const b = accessor(right);
      const order = a < b ? -1 : a > b ? 1 : 0;
      return sort.direction === "asc" ? order : -order;
    });
  }, [rows, sort, columns, onSortChange]);

  const cycleSort = (columnId: string) => {
    if (sort?.columnId !== columnId) setSort({ columnId, direction: "asc" });
    else if (sort.direction === "asc") setSort({ columnId, direction: "desc" });
    else setSort(null);
  };

  return (
    <Table density={density} className={className}>
      <TableHeader>
        <TableRow>
          {visibleColumns.map((column) => {
            const activeSort = sort?.columnId === column.id ? sort.direction : undefined;
            return (
              <TableHead
                key={column.id}
                aria-sort={
                  activeSort === "asc"
                    ? "ascending"
                    : activeSort === "desc"
                      ? "descending"
                      : undefined
                }
                className={cn(column.align === "right" && "text-right", column.headClassName)}
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5",
                    column.align === "right" && "justify-end",
                  )}
                >
                  {column.icon}
                  {column.sortable ? (
                    <button
                      type="button"
                      aria-label={sortLabel ? sortLabel(column.id) : undefined}
                      onClick={() => cycleSort(column.id)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-sm transition-colors hover:text-ink",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        activeSort && "text-primary",
                      )}
                    >
                      {column.header}
                      {activeSort === "asc" ? (
                        <ArrowUp className="size-3.5" aria-hidden />
                      ) : activeSort === "desc" ? (
                        <ArrowDown className="size-3.5" aria-hidden />
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-60" aria-hidden />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                  {column.headerExtra}
                </span>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRows.length === 0 && empty !== undefined ? (
          <TableRow>
            <TableCell colSpan={visibleColumns.length}>{empty}</TableCell>
          </TableRow>
        ) : (
          sortedRows.map((row) => (
            <TableRow
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && "cursor-pointer")}
            >
              {visibleColumns.map((column) => (
                <TableCell
                  key={column.id}
                  className={cn(column.align === "right" && "text-right", column.cellClassName)}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
