import { Fragment, type ReactNode } from "react";

import { cx } from "../../lib/cx";

export interface DataTableColumn<TRow> {
  readonly id: string;
  readonly header: string;
  /** A th className, e.g. "w-s8" — token-backed utilities only, never an arbitrary px value. */
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
  /**
   * The key of the row currently open in a detail pane. Tints it and marks it `aria-selected`, so
   * a master–detail screen shows which row the pane belongs to.
   */
  selectedRowKey?: string | null;
  /**
   * A group heading to draw ABOVE this row, e.g. "Today · 20 Jul 2026". Return null for rows that
   * continue the current group. Rendered as a full-width row, which is why it cannot be a column.
   */
  rowGroupLabel?: (row: TRow, index: number) => string | null;
  /** Row height: the design uses 56px by default, 48 for dense queues, 64 for rows with an avatar. */
  density?: "dense" | "default" | "roomy";
  /** Tighter horizontal padding, for the nine-column table inside a 900px modal. */
  tight?: boolean;
  /**
   * A totals row, rendered in a real `<tfoot>` so it stays associated with the table and is
   * announced as a summary rather than as one more data row. Cells must match the column count.
   */
  footer?: readonly ReactNode[];
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
  selectedRowKey = null,
  rowGroupLabel,
  density = "default",
  tight = false,
  footer,
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
          {rows.map((row, index) => {
            const key = rowKey(row);
            const tone = rowTone?.(row) ?? "default";
            const groupLabel = rowGroupLabel?.(row, index) ?? null;

            return (
              <Fragment key={key}>
                {groupLabel ? (
                  <tr className="table__group">
                    <th scope="colgroup" colSpan={columns.length}>
                      {groupLabel}
                    </th>
                  </tr>
                ) : null}
                <tr
                  aria-selected={selectedRowKey === null ? undefined : selectedRowKey === key}
                  className={cx(
                    tone === "danger" && "row-danger",
                    tone === "warning" && "row-warning",
                    selectedRowKey === key && "is-selected",
                    onRowClick && "cursor-pointer",
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cx(column.numeric && "num", column.cellClassName)}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
        {footer ? (
          <tfoot>
            <tr className="table__total">
              {footer.map((cell, cellIndex) => (
                <td
                  key={columns[cellIndex]?.id ?? cellIndex}
                  className={cx(columns[cellIndex]?.numeric && "num")}
                >
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

/** Groups the small outline buttons the design puts in a table's trailing Actions column. */
export function TableActions({ children }: { children: ReactNode }) {
  return <div className="table__actions">{children}</div>;
}
