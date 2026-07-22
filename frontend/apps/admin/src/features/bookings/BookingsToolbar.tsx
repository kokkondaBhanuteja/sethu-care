import { ListFilter } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { BookingsTabs } from "./BookingsTabs";
import type { BookingsListController } from "./useBookingsList";

export interface BookingsToolbarProps {
  list: BookingsListController;
}

/** Desktop segment row: the three tabs, the filter count, and an always-present way back out. */
export function BookingsToolbar({ list }: BookingsToolbarProps) {
  const { t } = useTranslation("adminBookings");

  return (
    <div className="flex flex-wrap items-center gap-s3">
      <BookingsTabs
        segment={list.segment}
        counts={list.query.data?.counts}
        onSegmentChange={list.selectSegment}
        variant="flush"
      />
      <div className="ml-auto flex items-center gap-s3">
        <Button
          variant="outline"
          size="inline"
          iconStart={ListFilter}
          onClick={() => list.setFilterOpen(true)}
        >
          {list.appliedFilterCount > 0
            ? t("filters.openWithCount", { count: list.appliedFilterCount })
            : t("filters.open")}
        </Button>
        <Button
          variant="textBrand"
          size="inline"
          disabled={!list.isFiltered}
          onClick={list.clearFilters}
        >
          {t("filters.clear")}
        </Button>
      </div>
    </div>
  );
}
