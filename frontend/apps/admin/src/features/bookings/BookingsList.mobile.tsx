import { ListFilter, WifiOff } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Badge } from "../../components/ui/Badge";
import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { CardList } from "../../components/ui/Card";
import { Pagination } from "../../components/ui/Pagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { SkeletonList } from "../../components/ui/Skeleton";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { CONNECTION_STATES, useConnectionStatus } from "../../hooks/useConnectionStatus";
import { Gutter } from "../../layouts/Layout";
import { MobileAppBar } from "../../layouts/MobileAppBar";
import { MobileScroll } from "../../layouts/PageMain";
import { SEGMENT_SUBJECT_KEYS } from "./bookings.constants";
import { BookingCard } from "./BookingCard";
import { BookingsEmptyState, BookingsSearchEmptyState } from "./BookingsEmptyState";
import { BookingsFilterSheet } from "./BookingsFilterSheet";
import { BookingsTabs } from "./BookingsTabs";
import { useBookingsList } from "./useBookingsList";

/**
 * The phone list: stacked cards, never the desktop table squeezed. The search field, the tabs and
 * the offline banner all sit outside the scroll region so none of them can be scrolled away while
 * an operator is triaging.
 */
export function BookingsListMobile() {
  const { t } = useTranslation("adminBookings");
  const list = useBookingsList();
  const isOffline = useConnectionStatus().state === CONNECTION_STATES.offline;

  return (
    <>
      <MobileAppBar
        title={t("title")}
        actions={
          <Button
            variant="text"
            size="inline"
            iconStart={ListFilter}
            aria-label={t("filters.buttonLabel", { count: list.appliedFilterCount })}
            onClick={() => list.setFilterOpen(true)}
          >
            <Badge count={list.appliedFilterCount} label={t("filters.title")} tone="brand" />
          </Button>
        }
      />

      {isOffline ? (
        <Banner
          tone="warning"
          icon={WifiOff}
          title={t("banner.offlineListTitle")}
          detail={t("banner.offlineListDetail")}
        />
      ) : null}

      <Gutter className="pt-s2 pb-s3">
        <SearchInput
          value={list.searchTerm}
          onValueChange={list.updateSearch}
          placeholder={t("search.placeholder")}
          label={t("search.label")}
        />
      </Gutter>

      <BookingsTabs
        segment={list.segment}
        counts={list.query.data?.counts}
        onSegmentChange={list.selectSegment}
        variant="fill"
      />

      <MobileScroll padFor="tabbar" className="px-s4 pt-s3">
        <QueryBoundary
          query={list.query}
          skeleton={<SkeletonList rows={8} rowClassName="h-row-72" label={t("loading.list")} />}
          isEmpty={(page) => page.items.length === 0}
          empty={
            list.activeSearch ? (
              <BookingsSearchEmptyState query={list.activeSearch} grow />
            ) : (
              <BookingsEmptyState segment={list.segment} grow />
            )
          }
          isFiltered={list.appliedFilterCount > 0}
          onClearFilters={list.clearFilters}
          grow
        >
          {(page) => (
            <>
              {list.activeSearch ? (
                <p className="text-caption text-text-3 pb-s2" aria-live="polite">
                  {page.total === 1
                    ? t("search.resultCountOne")
                    : t("search.resultCountMany", { count: page.total })}{" "}
                  {list.activeSearch}
                </p>
              ) : null}

              <CardList>
                {page.items.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} search={list.activeSearch} />
                ))}
              </CardList>

              <Pagination
                shown={page.items.length}
                total={page.total}
                subject={page.isAcrossSegments ? undefined : t(SEGMENT_SUBJECT_KEYS[list.segment])}
                onLoadMore={list.canLoadMore ? list.loadMore : undefined}
                isLoadingMore={list.query.isFetching}
              />
            </>
          )}
        </QueryBoundary>
      </MobileScroll>

      <BookingsFilterSheet
        isOpen={list.isFilterOpen}
        onDismiss={() => list.setFilterOpen(false)}
        availableStates={list.availableStates}
        selectedStates={list.selectedStates}
        onToggleState={list.toggleState}
        onClear={list.clearFilters}
      />
    </>
  );
}
