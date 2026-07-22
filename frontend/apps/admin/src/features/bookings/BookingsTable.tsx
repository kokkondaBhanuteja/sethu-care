import { useTranslation } from "@sethu/i18n";

import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { formatMoney, formatPhone, formatTime } from "../../lib/format";
import { BOOKING_STATE_PRESENTATION } from "./bookings.constants";
import { BookingStatePill } from "./BookingStatePill";
import { MatchHighlight, MonoText } from "./RecordText";
import { useBookingCopy } from "./useBookingCopy";
import type { BookingListItem } from "./bookings.types";

export interface BookingsTableProps {
  rows: readonly BookingListItem[];
  /** The active search term. A PHONE column appears only while one is running — see below. */
  search: string;
  onSelect: (booking: BookingListItem) => void;
}

/**
 * The desktop queue. The wider canvas exists so an operator can scan the STATE and PROVIDER columns
 * down the page; mobile stacks the same records into cards instead and is never this table squeezed.
 *
 * The PHONE column is added only while a search is running: without it a phone-number search would
 * highlight nothing, and the matched digits have to be visible for the result set to explain itself
 * (design BOX 16). It is the search key, so it earns a column exactly as long as it is one.
 */
export function BookingsTable({ rows, search, onSelect }: BookingsTableProps) {
  const { t } = useTranslation("adminBookings");
  const { shortName } = useBookingCopy();

  const columns: readonly DataTableColumn<BookingListItem>[] = [
    {
      id: "booking",
      header: t("columns.booking"),
      render: (row) => (
        <MonoText className="text-text-1">
          <MatchHighlight text={row.reference} query={search} />
        </MonoText>
      ),
    },
    {
      id: "state",
      header: t("columns.state"),
      render: (row) => <BookingStatePill state={row.state} isAdminVerified={row.isAdminVerified} />,
    },
    { id: "service", header: t("columns.service"), render: (row) => row.serviceName },
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
    { id: "area", header: t("columns.area"), render: (row) => row.area },
    {
      id: "time",
      header: t("columns.time"),
      cellClassName: "whitespace-nowrap text-text-2",
      render: (row) => formatTime(row.slotAt),
    },
    {
      id: "amount",
      header: t("columns.amount"),
      numeric: true,
      render: (row) => formatMoney(row.amountPaise),
    },
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
  ];

  return (
    <DataTable
      caption={t("table.caption")}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      rowTone={(row) => BOOKING_STATE_PRESENTATION[row.state].rowTone}
      onRowClick={onSelect}
      density="dense"
    />
  );
}
