import type { ReactNode } from "react";

import { cx } from "../../lib/cx";

export interface DataTableColumn<TRow> {
  readonly id: string;
  readonly header: string;
  /** Token-backed width utility, e.g. "w-[132px]" is NOT allowed — use a th className with a token. */
  readonly headerClassName?: string;
  readonly cellClassName?: string;
  /** Right-aligned tabular figures — ages, amounts, counts. */
  readonly numeric?: boolean;
  readonly render: (row: TRow) => ReactNode;
}

export interface DataTableProps<TRow> {
  /** Names the table for assistive tech, e.g. "Bookings needing attention". */
  caption: string;
  columns: readonly DataTableColumn<TRow>[];
  rows: readonly TRow[];
  rowKey: (row: TRow) => string;
  /** Severity tint for a row — the queue tables mark escalated rows red. */
  rowTone?: (row: TRow) => "default" | "danger" | "warning";
  onRowClick?: (row: TRow) => void;
  /** Row height: the design uses 56px by default, 48 for dense queues, 64 for rows with an avatar. */
  density?: "dense" | "default" | "roomy";
  /** Tighter horizontal padding, for the nine-column table inside a 900px modal. */
  tight?: boolean;
  className?: string;
}

const DENSITY_CLASSES = { dense: "table--dense", default: "", roomy: "table--64" } as const;

/**
 * The desktop queue table. Mobile stacks the same records into cards instead — that is the whole
 * point of the wider canvas: an operator scans the AGE and PROVIDER columns down the page to find
 * the worst problem, which stacked cards make impossible.
 *
 * Wrapped in a scroll container so a wide table never pushes the page sideways.
 */
export function DataTable<TRow>({
  caption,
  columns,
  rows,
  rowKey,
  rowTone,
  onRowClick,
  density = "default",
  tight = false,
  className,
}: DataTableProps<TRow>) {
  return (
    <div className="table-scroll">
      <table className={cx("table", DENSITY_CLASSES[density], tight && "table--tight", className)}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cx(column.numeric && "num", column.headerClassName)}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const tone = rowTone?.(row) ?? "default";
            return (
              <tr
                key={rowKey(row)}
                className={cx(
                  tone === "danger" && "row-danger",
                  tone === "warning" && "row-warning",
                  onRowClick && "cursor-pointer",
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.id} className={cx(column.numeric && "num", column.cellClassName)}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Groups the small outline buttons the design puts in a table's trailing Actions column. */
export function TableActions({ children }: { children: ReactNode }) {
  return <div className="table__actions">{children}</div>;
}
