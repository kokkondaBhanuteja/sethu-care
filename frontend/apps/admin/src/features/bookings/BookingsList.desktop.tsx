import { useState } from "react";
import { useTranslation } from "@sethu/i18n";
import { PageHeader } from "@sethu/ui-web";

import { PageMain } from "../../layouts/PageMain";
import { Topbar } from "../../layouts/Topbar";
import { BookingPreviewActions, hasPreviewActions } from "./BookingPreviewActions";
import { BookingPreviewDrawer } from "./BookingPreviewDrawer";
import { BookingPreviewPanel } from "./BookingPreviewPanel";
import { BookingsFilterBand } from "./BookingsFilterBand";
import { BookingsSummaryStrip } from "./BookingsSummaryStrip";
import { BookingsTableCard } from "./BookingsTableCard";
import { useBookingActions } from "./useBookingActions";
import { useBookingPreview } from "./useBookingPreview";
import { useBookingsList } from "./useBookingsList";
import { useHasSidePreview } from "./useBookingsListLayout";

/**
 * The reference table-screen anatomy, top to bottom: page header, labelled filter band, the
 * exception-load stat strip, then the queue. At ≥1280px the queue card sits beside the permanent
 * preview panel; below that the panel becomes an on-demand drawer so the table keeps the full
 * canvas — deliberately not the mobile card list widened (spec §2.1).
 */
export function BookingsListDesktop() {
  const { t } = useTranslation("adminBookings");
  const list = useBookingsList();
  const hasSidePreview = useHasSidePreview();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  const rows = list.query.data?.items ?? [];
  // The side panel always previews something (the first row); the drawer only opens on a click.
  const previewId = hasSidePreview ? (selectedId ?? rows[0]?.id ?? null) : selectedId;
  const preview = useBookingPreview(previewId);
  const previewActions = useBookingActions(previewId ?? "", preview.detail?.state ?? null);
  const previewFooter = hasPreviewActions(previewActions) ? (
    <BookingPreviewActions actions={previewActions} />
  ) : undefined;

  return (
    <>
      <Topbar crumbs={[{ label: t("title") }]} pageRendersHeading />

      <PageMain>
        <PageHeader title={t("title")} />

        <BookingsFilterBand
          searchTerm={list.searchTerm}
          onSearchChange={list.updateSearch}
          availableStates={list.availableStates}
          selectedStates={list.selectedStates}
          onReplaceStates={list.replaceStates}
          isFiltered={list.isFiltered}
          onClear={list.clearFilters}
        />

        <BookingsSummaryStrip summary={list.query.data?.summary} list={list} />

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
          <BookingsTableCard
            className="min-w-0 xl:col-span-2"
            list={list}
            selectedId={previewId}
            onSelect={(booking) => {
              setSelectedId(booking.id);
              if (!hasSidePreview) setDrawerOpen(true);
            }}
          />

          {hasSidePreview ? (
            <BookingPreviewPanel
              detail={preview.detail}
              isLoading={preview.isLoading}
              footer={previewFooter}
            />
          ) : null}
        </div>

        {hasSidePreview ? null : (
          <BookingPreviewDrawer
            isOpen={isDrawerOpen && previewId !== null}
            onDismiss={() => setDrawerOpen(false)}
            detail={preview.detail}
            isLoading={preview.isLoading}
            footer={previewFooter}
          />
        )}
      </PageMain>
    </>
  );
}
