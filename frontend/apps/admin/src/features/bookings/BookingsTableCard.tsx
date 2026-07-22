import { useTranslation } from "@sethu/i18n";
import { Card, CardFooter, CardHeader } from "@sethu/ui-web";

import { Pagination } from "../../components/ui/Pagination";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { SEGMENT_SUBJECT_KEYS } from "./bookings.constants";
import { BookingsEmptyState, BookingsSearchEmptyState } from "./BookingsEmptyState";
import { BookingsResultSummary } from "./BookingsResultSummary";
import { BookingsTable } from "./BookingsTable";
import { BookingsTableSkeleton } from "./BookingsTableSkeleton";
import { BookingsTabs } from "./BookingsTabs";
import type { BookingListItem } from "./bookings.types";
import type { BookingsListController } from "./useBookingsList";

export interface BookingsTableCardProps {
  list: BookingsListController;
  selectedId: string | null;
  onSelect: (booking: BookingListItem) => void;
  className?: string;
}

/**
 * The queue as one white card (the reference's table-screen anatomy): segment tabs in the card
 * header, the inset-banded table as the body, and the count line with "Load more" in the card
 * footer — so the table, its scope and its paging read as a single object on the canvas.
 */
export function BookingsTableCard({
  list,
  selectedId,
  onSelect,
  className,
}: BookingsTableCardProps) {
  const { t } = useTranslation("adminBookings");

  return (
    <Card className={className}>
      <CardHeader>
        <BookingsTabs
          segment={list.segment}
          counts={list.query.data?.counts}
          onSegmentChange={list.selectSegment}
          variant="flush"
        />
      </CardHeader>

      {/* Aligned to the card's own padding so the count line sits flush with the header row. */}
      <div className="px-2 sm:px-3">
        <BookingsResultSummary
          search={list.activeSearch}
          total={list.query.data?.total ?? 0}
          isAcrossSegments={list.query.data?.isAcrossSegments ?? false}
          onClearSearch={() => list.updateSearch("")}
        />
      </div>

      <QueryBoundary
        query={list.query}
        skeleton={<BookingsTableSkeleton />}
        isEmpty={(page) => page.items.length === 0}
        empty={
          list.activeSearch ? (
            <BookingsSearchEmptyState query={list.activeSearch} />
          ) : (
            <BookingsEmptyState segment={list.segment} />
          )
        }
        isFiltered={list.appliedFilterCount > 0}
        onClearFilters={list.clearFilters}
      >
        {(page) => (
          <>
            <BookingsTable
              rows={page.items}
              search={list.activeSearch}
              onSelect={onSelect}
              selectedId={selectedId}
              stateFilter={{
                available: list.availableStates,
                selected: list.selectedStates,
                onChange: list.replaceStates,
              }}
            />
            {/* The pagination row owns the footer width so its count and Load more sit at the
                card's two ends, matching the reference's card-footer paging. */}
            <CardFooter className="block">
              <Pagination
                shown={page.items.length}
                total={page.total}
                subject={page.isAcrossSegments ? undefined : t(SEGMENT_SUBJECT_KEYS[list.segment])}
                onLoadMore={list.canLoadMore ? list.loadMore : undefined}
                isLoadingMore={list.query.isFetching}
              />
            </CardFooter>
          </>
        )}
      </QueryBoundary>
    </Card>
  );
}
