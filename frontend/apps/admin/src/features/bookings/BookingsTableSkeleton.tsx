import { useTranslation } from "@sethu/i18n";

import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { Skeleton } from "../../components/ui/Skeleton";
import { BOOKINGS_PAGE_SIZE } from "./bookings.constants";

interface PlaceholderRow {
  readonly id: string;
  readonly index: number;
}

const ROWS: readonly PlaceholderRow[] = Array.from(
  { length: BOOKINGS_PAGE_SIZE },
  (_row, index) => ({
    id: `booking-skeleton-${index}`,
    index,
  }),
);

/** Widths vary per column and per row so the placeholder reads as text, not as a progress bar. */
const WIDTHS = ["w-3/4", "w-full", "w-2/3", "w-5/6"] as const;

function bar(row: PlaceholderRow, offset: number, alignRight = false) {
  const width = WIDTHS[(row.index + offset) % WIDTHS.length] ?? "w-3/4";
  return <Skeleton shape="text" className={alignRight ? `${width} ml-auto` : width} />;
}

/**
 * Ten skeleton rows, never a spinner. A spinner says "wait" and nothing else; a skeleton says "a
 * table of ten bookings is arriving and the columns will be where you expect them" — and because
 * the header row stays live, the chrome the operator is about to act on does not reflow when the
 * data lands (design BOX 17).
 */
export function BookingsTableSkeleton() {
  const { t } = useTranslation("adminBookings");

  const columns: readonly DataTableColumn<PlaceholderRow>[] = [
    { id: "booking", header: t("columns.booking"), render: (row) => bar(row, 0) },
    {
      id: "state",
      header: t("columns.state"),
      render: () => <Skeleton shape="pill" className="w-3/4" />,
    },
    { id: "service", header: t("columns.service"), render: (row) => bar(row, 1) },
    { id: "customer", header: t("columns.customer"), render: (row) => bar(row, 2) },
    { id: "area", header: t("columns.area"), render: (row) => bar(row, 3) },
    { id: "time", header: t("columns.time"), render: (row) => bar(row, 1) },
    {
      id: "amount",
      header: t("columns.amount"),
      numeric: true,
      render: (row) => bar(row, 2, true),
    },
    { id: "provider", header: t("columns.provider"), render: (row) => bar(row, 0) },
  ];

  return (
    <div role="status" aria-busy aria-label={t("loading.list")}>
      <DataTable
        caption={t("table.caption")}
        columns={columns}
        rows={ROWS}
        rowKey={(row) => row.id}
        density="dense"
      />
    </div>
  );
}
