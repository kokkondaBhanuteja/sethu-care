import { useState } from "react";
import { useTranslation } from "@sethu/i18n";
import { PageHeader } from "@sethu/ui-web";

import { Button } from "../../components/ui/Button";
import { PageMain } from "../../layouts/PageMain";
import { Topbar } from "../../layouts/Topbar";
import { BookingActionButtons } from "./BookingActionButtons";
import { BookingPreviewPanel } from "./BookingPreviewPanel";
import { BookingsFilterBand } from "./BookingsFilterBand";
import { BookingsSummaryStrip } from "./BookingsSummaryStrip";
import { BookingsTableCard } from "./BookingsTableCard";
import { useBookingActions } from "./useBookingActions";
import { useBookingPreview } from "./useBookingPreview";
import { useBookingsList } from "./useBookingsList";

/**
 * The reference table-screen anatomy, top to bottom: page header, labelled filter band, segment
 * stat strip, then the master–detail row — the queue as one card beside the preview panel. The
 * table keeps its place while the preview answers "what is wrong with this one?"; deliberately not
 * the mobile card list widened (spec §2.1).
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
      <Topbar crumbs={[{ label: t("title") }]} />

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

        <BookingsSummaryStrip counts={list.query.data?.counts} />

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <BookingsTableCard
            className="min-w-0 lg:col-span-2"
            list={list}
            selectedId={previewId}
            onSelect={(booking) => setSelectedId(booking.id)}
          />

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
      </PageMain>
    </>
  );
}
