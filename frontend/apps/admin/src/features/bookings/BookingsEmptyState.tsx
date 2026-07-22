import { CalendarX2, SearchX } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { EmptyState } from "../../components/ui/EmptyState";
import { BOOKING_SEGMENTS, type BookingSegment } from "./bookings.constants";

export interface BookingsEmptyStateProps {
  segment: BookingSegment;
  grow?: boolean;
}

const COPY_BY_SEGMENT = {
  [BOOKING_SEGMENTS.active]: { title: "empty.activeTitle", body: "empty.activeBody" },
  [BOOKING_SEGMENTS.completed]: { title: "empty.completedTitle", body: "empty.completedBody" },
  [BOOKING_SEGMENTS.cancelled]: { title: "empty.cancelledTitle", body: "empty.cancelledBody" },
} as const;

/** Segment-specific copy, per spec §6.8 — "Nothing here" says nothing about which bucket is empty. */
export function BookingsEmptyState({ segment, grow = false }: BookingsEmptyStateProps) {
  const { t } = useTranslation("adminBookings");
  const copy = COPY_BY_SEGMENT[segment];

  return <EmptyState icon={CalendarX2} title={t(copy.title)} body={t(copy.body)} grow={grow} />;
}

export interface BookingsSearchEmptyStateProps {
  query: string;
  grow?: boolean;
}

/**
 * A search that found nothing, kept distinct from a genuinely empty segment (spec §4.10). The tip
 * line names the three things the field actually indexes, so the operator learns whether the
 * booking is missing or the query was the wrong kind of thing.
 */
export function BookingsSearchEmptyState({ query, grow = false }: BookingsSearchEmptyStateProps) {
  const { t } = useTranslation("adminBookings");

  return (
    <EmptyState
      icon={SearchX}
      title={t("search.emptyTitle", { query })}
      body={t("search.emptyBody")}
      grow={grow}
    />
  );
}
