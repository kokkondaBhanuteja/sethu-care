import { useTranslation } from "@sethu/i18n";
import { KpiTile } from "@sethu/ui-web";

import { formatDuration } from "../../lib/format";
import { BOOKING_SEGMENTS, BOOKING_STATES, UNASSIGNED_FILTER_STATES } from "./bookings.constants";
import type { BookingsSummary } from "./bookings.types";
import type { BookingsListController } from "./useBookingsList";

export interface BookingsSummaryStripProps {
  summary: BookingsSummary | undefined;
  list: BookingsListController;
}

const MINUTE_MS = 60_000;

/**
 * The stat strip carries what the tabs cannot: the escalation load, the age of the worst-waiting
 * unassigned booking, and today's completions. (It used to repeat the three tab counts, 80px
 * below them.) Each tile is a drill-down — clicking applies the narrowing that answers it, so a
 * number an operator worries about is one click from its rows.
 */
export function BookingsSummaryStrip({ summary, list }: BookingsSummaryStripProps) {
  const { t } = useTranslation("adminBookings");
  if (!summary) return null;

  const tiles = [
    {
      key: "escalated",
      label: t("summary.escalated"),
      value: String(summary.escalated),
      onClick: () => {
        list.selectSegment(BOOKING_SEGMENTS.active);
        list.replaceStates([BOOKING_STATES.escalated]);
      },
    },
    {
      key: "oldestUnassigned",
      label: t("summary.oldestUnassigned"),
      value:
        summary.oldestUnassignedMinutes === null
          ? t("summary.noneValue")
          : formatDuration(summary.oldestUnassignedMinutes * MINUTE_MS),
      onClick: () => {
        list.selectSegment(BOOKING_SEGMENTS.active);
        list.replaceStates(UNASSIGNED_FILTER_STATES);
      },
    },
    {
      key: "completedToday",
      label: t("summary.completedToday"),
      value: String(summary.completedToday),
      onClick: () => {
        list.selectSegment(BOOKING_SEGMENTS.completed);
        list.replaceStates([]);
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {tiles.map((tile) => (
        <KpiTile key={tile.key} label={tile.label} value={tile.value} onClick={tile.onClick} />
      ))}
    </div>
  );
}
