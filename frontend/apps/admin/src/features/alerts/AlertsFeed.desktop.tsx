import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "@sethu/i18n";
import { FilterBand, FilterField, PageHeader } from "@sethu/ui-web";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Card } from "../../components/ui/Card";
import { FilterBar } from "../../components/ui/FilterBar";
import { PageMain } from "../../layouts/PageMain";
import { Topbar } from "../../layouts/Topbar";
import { AlertNeedsActionSection } from "./AlertNeedsActionSection";
import { AlertNoticeList } from "./AlertNoticeList";
import { AlertPreview, AlertPreviewEmpty } from "./AlertPreview";
import { AllCaughtUpEmpty, AllCaughtUpStrip } from "./AlertsAllCaughtUp";
import { AlertsFeedSkeleton } from "./AlertsFeedSkeleton";
import { AlertsOfflineBanner } from "./AlertsOfflineBanner";
import { severityChips, toSeverityFilter } from "./alerts.filters";
import { countUnacknowledgedCritical, splitTiers } from "./alerts.selectors";
import { useAlertsFeed } from "./useAlertsFeed";

/**
 * Desktop BOX 13–14 in the reference page language: crumb in the Topbar, ui-web PageHeader as the
 * one visible h1, a labelled FilterBand Card over the feed, then the master–detail split — two
 * tiers of visual weight beside the preview pane, so an alert can be judged without leaving the
 * queue. "Mark read" lives on the informational tier's own header (AlertNoticeList), because a
 * page-level control that only touches one tier misstates its reach.
 */
export function AlertsFeedDesktop() {
  const { t } = useTranslation("adminAlerts");
  const navigate = useNavigate();
  const feed = useAlertsFeed();
  const { acknowledgement } = feed;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <Topbar crumbs={[{ label: t("feedTitle") }]} pageRendersHeading />
      <AlertsOfflineBanner
        isOnline={acknowledgement.isOnline}
        queuedCount={acknowledgement.queuedIds.length}
      />

      <PageMain>
        <PageHeader title={t("feedTitle")} />

        <QueryBoundary
          query={feed.query}
          skeleton={<AlertsFeedSkeleton />}
          isEmpty={(alerts) => alerts.length === 0}
          empty={<AllCaughtUpEmpty />}
          isFiltered={feed.isFiltered}
          onClearFilters={feed.clearFilters}
          grow
        >
          {(alerts) => {
            const tiers = splitTiers(alerts, feed.severityFilter);
            return (
              <>
                <Card>
                  <FilterBand className="sm:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1">
                    <FilterField label={t("filters.severityLabel")}>
                      <FilterBar
                        label={t("filters.label")}
                        chips={severityChips(alerts, feed.severityFilter, t)}
                        onToggle={(chipId) => feed.setSeverityFilter(toSeverityFilter(chipId))}
                      />
                    </FilterField>
                  </FilterBand>
                </Card>

                <div className="mt-s3 flex flex-col items-start gap-s6 shell:flex-row">
                  <div
                    className="min-w-0 grow shell:basis-1/2"
                    aria-label={t("feedRegion")}
                    role="region"
                  >
                    {tiers.needsAction.length > 0 ? (
                      <AlertNeedsActionSection
                        alerts={tiers.needsAction}
                        unacknowledgedCount={countUnacknowledgedCritical(alerts)}
                        acknowledgement={acknowledgement}
                        onSelect={(alert) => setSelectedId(alert.id)}
                        onOpenRecord={(route) => void navigate(route)}
                        selectedId={selectedId}
                      />
                    ) : (
                      <AllCaughtUpStrip />
                    )}

                    <AlertNoticeList
                      today={tiers.noticesToday}
                      earlier={tiers.noticesEarlier}
                      showTierLabel
                      onMarkRead={feed.markRead}
                      isMarkingRead={feed.isMarkingRead}
                    />
                  </div>

                  <div
                    className="min-w-0 grow shell:basis-1/2"
                    aria-label={t("previewRegion")}
                    role="region"
                  >
                    {selectedId ? <AlertPreview alertId={selectedId} /> : <AlertPreviewEmpty />}
                  </div>
                </div>
              </>
            );
          }}
        </QueryBoundary>
      </PageMain>
    </>
  );
}
