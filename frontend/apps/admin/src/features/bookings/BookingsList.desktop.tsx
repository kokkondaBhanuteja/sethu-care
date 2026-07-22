import { useState } from "react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Pagination } from "../../components/ui/Pagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Topbar } from "../../layouts/Topbar";
import { SEGMENT_SUBJECT_KEYS } from "./bookings.constants";
import { BookingActionButtons } from "./BookingActionButtons";
import { BookingPreviewPanel } from "./BookingPreviewPanel";
import { BookingsEmptyState, BookingsSearchEmptyState } from "./BookingsEmptyState";
import { BookingsFilterSheet } from "./BookingsFilterSheet";
import { BookingsResultSummary } from "./BookingsResultSummary";
import { BookingsTable } from "./BookingsTable";
import { BookingsTableSkeleton } from "./BookingsTableSkeleton";
import { BookingsToolbar } from "./BookingsToolbar";
import { useBookingActions } from "./useBookingActions";
import { useBookingPreview } from "./useBookingPreview";
import { useBookingsList } from "./useBookingsList";

/**
 * Master–detail: the table keeps its place while the preview answers "what is wrong with this
 * one?". Deliberately not the mobile card list widened — the wider canvas exists so a queue can be
 * a table an operator scans down a column, which stacked cards make impossible (spec §2.1).
 */
export function BookingsListDesktop() {
  const { t } = useTranslation("adminBookings");
  const list = useBookingsList();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = list.query.data?.items ?? [];
  const previewId = selectedId ?? rows[0]?.id ?? null;
  const preview = useBookingPreview(previewId);
  const previewActions = useBookingActions(previewId ?? "", preview.detail?.state ?? null);

  return (
    <>
      <Topbar
        title={t("title")}
        actions={
          <SearchInput
            value={list.searchTerm}
            onValueChange={list.updateSearch}
            placeholder={t("search.placeholder")}
            label={t("search.label")}
          />
        }
      />

      <main className="flex-1 overflow-y-auto bg-canvas p-s6">
        <div className="grid grid-cols-1 gap-s5 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <BookingsToolbar list={list} />

            <BookingsResultSummary
              search={list.activeSearch}
              total={list.query.data?.total ?? 0}
              isAcrossSegments={list.query.data?.isAcrossSegments ?? false}
              onClearSearch={() => list.updateSearch("")}
            />

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
                    onSelect={(booking) => setSelectedId(booking.id)}
                  />
                  <Pagination
                    shown={page.items.length}
                    total={page.total}
                    subject={
                      page.isAcrossSegments ? undefined : t(SEGMENT_SUBJECT_KEYS[list.segment])
                    }
                    onLoadMore={list.canLoadMore ? list.loadMore : undefined}
                    isLoadingMore={list.query.isFetching}
                  />
                </>
              )}
            </QueryBoundary>
          </div>

          <BookingPreviewPanel
            detail={preview.detail}
            isLoading={preview.isLoading}
            footer={
              // The preview offers only the decision this record is usually opened to make;
              // everything else lives on the full record, one click away (design BOX 15).
              previewActions.canAcknowledge || previewActions.primary ? (
                <div className="flex items-center gap-s3">
                  {previewActions.canAcknowledge ? (
                    <Button variant="primary" size="section" block>
                      {t("actions.acknowledge")}
                    </Button>
                  ) : null}
                  {previewActions.primary ? (
                    <BookingActionButtons actions={[previewActions.primary]} size="section" block />
                  ) : null}
                </div>
              ) : undefined
            }
          />
        </div>
      </main>

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
