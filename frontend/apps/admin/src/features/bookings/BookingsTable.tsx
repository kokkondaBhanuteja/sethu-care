import type { MouseEvent } from "react";
import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";
import { TableActionLink, TableColumnFilter } from "@sethu/ui-web";

import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { formatPhone, formatTime } from "../../lib/format";
import { ROUTES } from "../../routes/routes.constants";
import { BOOKING_STATE_PRESENTATION, type BookingState } from "./bookings.constants";
import { BookingStatePill } from "./BookingStatePill";
import { MatchHighlight, MonoText } from "./RecordText";
import { useBookingCopy } from "./useBookingCopy";
import type { BookingListItem } from "./bookings.types";

export interface BookingsTableStateFilter {
  readonly available: readonly BookingState[];
  readonly selected: readonly BookingState[];
  readonly onChange: (states: readonly BookingState[]) => void;
}

export interface BookingsTableProps {
  rows: readonly BookingListItem[];
  search: string;
  onSelect: (booking: BookingListItem) => void;
  /** The row currently open in the preview pane — tinted and `aria-selected`. */
  selectedId?: string | null;
  /** The caret filter on the STATE column (the reference's in-header filtering). */
  stateFilter?: BookingsTableStateFilter;
}

/** The exit affordance stays visible even if the table still overflows: sticky against the wrapper. */
const STICKY_CELL_CLASSES = "sticky right-0 z-10 bg-surface text-right";
const STICKY_HEAD_CLASSES = "sticky right-0 z-10 bg-inset";

/**
 * The desktop queue, on a column budget that fits its card: TIME rides under BOOKING and AREA
 * under SERVICE as sub-lines, and AMOUNT lives in the preview — the old eight-column table ran
 * 224px past its wrapper, hiding three columns behind an unnoticed scroll. PHONE exists only
 * while a search runs (the matched digits must be visible, design BOX 16). Row click selects the
 * preview; the sticky-right chevron link is the committed "open the record" affordance.
 */
export function BookingsTable({
  rows,
  search,
  onSelect,
  selectedId,
  stateFilter,
}: BookingsTableProps) {
  const { t } = useTranslation("adminBookings");
  const { shortName } = useBookingCopy();

  const stateFilterControl = stateFilter ? (
    <TableColumnFilter
      label={t("filters.stateGroup")}
      options={stateFilter.available.map((state) => ({ value: state, label: t(`state.${state}`) }))}
      selected={stateFilter.selected}
      onChange={(nextSelection) =>
        stateFilter.onChange(stateFilter.available.filter((state) => nextSelection.includes(state)))
      }
      clearLabel={t("filters.clear")}
    />
  ) : undefined;

  const columns: readonly DataTableColumn<BookingListItem>[] = [
    {
      id: "booking",
      header: t("columns.booking"),
      render: (row) => (
        <span className="flex flex-col">
          <MonoText className="text-text-1">
            <MatchHighlight text={row.reference} query={search} />
          </MonoText>
          <span className="text-caption text-text-3 whitespace-nowrap">
            {formatTime(row.slotAt)}
          </span>
        </span>
      ),
    },
    {
      id: "state",
      header: t("columns.state"),
      ...(stateFilterControl ? { filter: stateFilterControl } : {}),
      render: (row) => <BookingStatePill state={row.state} isAdminVerified={row.isAdminVerified} />,
    },
    {
      id: "service",
      header: t("columns.service"),
      render: (row) => (
        <span className="flex flex-col">
          <span>{row.serviceName}</span>
          <span className="text-caption text-text-3">{row.area}</span>
        </span>
      ),
    },
    { id: "customer", header: t("columns.customer"), render: (row) => row.customerName },
    ...(search
      ? [
          {
            id: "phone",
            header: t("columns.phone"),
            render: (row: BookingListItem) => (
              <MonoText className="text-text-2">
                <MatchHighlight text={formatPhone(row.customerPhone)} query={search} />
              </MonoText>
            ),
          },
        ]
      : []),
    {
      id: "provider",
      header: t("columns.provider"),
      render: (row) =>
        row.providerName ? (
          shortName(row.providerName)
        ) : (
          <span className="text-label font-semibold text-danger">{t("provider.unassigned")}</span>
        ),
    },
    {
      id: "open",
      header: "",
      headerClassName: STICKY_HEAD_CLASSES,
      cellClassName: STICKY_CELL_CLASSES,
      render: (row) => (
        <TableActionLink
          as={Link}
          to={ROUTES.bookingDetail(row.id)}
          aria-label={t("detail.openFull")}
          onClick={(event: MouseEvent) => event.stopPropagation()}
        />
      ),
    },
  ];

  return (
    <DataTable
      caption={t("table.caption")}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      rowTone={(row) => BOOKING_STATE_PRESENTATION[row.state].rowTone}
      onRowClick={onSelect}
      selectedRowKey={selectedId ?? null}
      density="dense"
      // Tighter cell padding shrinks only the table's MINIMUM width (it stretches w-full at 1440
      // regardless) — the margin that lets the six columns fit beside the preview panel at 1280.
      tight
    />
  );
}
