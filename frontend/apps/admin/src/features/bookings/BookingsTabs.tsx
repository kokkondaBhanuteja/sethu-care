import { useTranslation } from "@sethu/i18n";

import { Tabs } from "../../components/ui/Tabs";
import { BOOKING_SEGMENTS, type BookingSegment } from "./bookings.constants";
import type { BookingSegmentCounts } from "./bookings.types";

export interface BookingsTabsProps {
  segment: BookingSegment;
  counts: BookingSegmentCounts | undefined;
  onSegmentChange: (segment: BookingSegment) => void;
  /** `flush` drops the gutter, which is what the desktop toolbar row needs. */
  variant?: "default" | "fill" | "flush";
}

/**
 * Three segments, and deliberately only three. There is no "Scheduled" tab because the product has
 * no future-dated bookings at all — every booking dispatches the instant it is created, so a fourth
 * tab would advertise a capability that does not exist (docs/Booking-Workflow-Decisions.md D1).
 */
export function BookingsTabs({
  segment,
  counts,
  onSegmentChange,
  variant = "default",
}: BookingsTabsProps) {
  const { t } = useTranslation("adminBookings");

  const items = [
    { value: BOOKING_SEGMENTS.active, label: t("segments.active"), count: counts?.active },
    { value: BOOKING_SEGMENTS.completed, label: t("segments.completed"), count: counts?.completed },
    { value: BOOKING_SEGMENTS.cancelled, label: t("segments.cancelled"), count: counts?.cancelled },
  ].map((item) => (item.count === undefined ? { value: item.value, label: item.label } : item));

  return (
    <Tabs
      label={t("segments.label")}
      items={items}
      value={segment}
      onValueChange={onSegmentChange}
      variant={variant}
    />
  );
}
