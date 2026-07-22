import type { ReactNode } from "react";

/** Column configuration for DataTable — extracted so the component stays within the 150-line cap. */
export interface DataTableColumn<TRow> {
  readonly id: string;
  readonly header: string;
  /** A th className, e.g. "w-s8" — token-backed utilities only, never an arbitrary px value. */
  readonly headerClassName?: string;
  readonly cellClassName?: string;
  /** Right-aligned tabular figures — ages, amounts, counts. */
  readonly numeric?: boolean;
  /**
   * A header filter affordance — pass a ui-web <TableColumnFilter> where the design puts a caret
   * filter on the column (status/state columns). Rendered beside the caption in the header cell.
   */
  readonly filter?: ReactNode;
  readonly render: (row: TRow) => ReactNode;
}

export interface DataTableProps<TRow> {
  /** Names the table for assistive tech, e.g. "Bookings needing attention". */
  caption: string;
  columns: readonly DataTableColumn<TRow>[];
  rows: readonly TRow[];
  rowKey: (row: TRow) => string;
  /** Per-row treatment: severity tints, `muted` for settled records, `faded` for stale ones. */
  rowTone?: (row: TRow) => "default" | "danger" | "warning" | "muted" | "faded";
  onRowClick?: (row: TRow) => void;
  /** The key of the row currently open in a detail pane. Tints it and marks it `aria-selected`. */
  selectedRowKey?: string | null;
  /** A group heading drawn ABOVE this row; return null for rows continuing the current group. */
  rowGroupLabel?: (row: TRow, index: number) => string | null;
  /** Row rhythm: `dense` for deep queues, `roomy` for rows carrying an avatar. */
  density?: "dense" | "default" | "roomy";
  /** Tighter horizontal padding, for the nine-column table inside a wide modal. */
  tight?: boolean;
  /** A totals row in a real `<tfoot>`, announced as a summary rather than one more record. */
  footer?: readonly ReactNode[];
  className?: string;
}
