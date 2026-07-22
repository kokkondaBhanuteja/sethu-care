import { useTranslation } from "@sethu/i18n";

import { KpiTile } from "../../components/ui/KpiTile";
import type { BookingSegmentCounts } from "./bookings.types";

export interface BookingsSummaryStripProps {
  counts: BookingSegmentCounts | undefined;
}

/**
 * The compact stat strip between the filter band and the table: one tile per segment, so the shape
 * of the day is readable before a single row is. Purely informative — the tabs on the table card
 * remain the segment control, and these numbers are the same counts those tabs carry.
 */
export function BookingsSummaryStrip({ counts }: BookingsSummaryStripProps) {
  const { t } = useTranslation("adminBookings");
  if (!counts) return null;

  const tiles = [
    { key: "active", label: t("segments.active"), value: counts.active },
    { key: "completed", label: t("segments.completed"), value: counts.completed },
    { key: "cancelled", label: t("segments.cancelled"), value: counts.cancelled },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {tiles.map((tile) => (
        <KpiTile key={tile.key} label={tile.label} value={String(tile.value)} />
      ))}
    </div>
  );
}
