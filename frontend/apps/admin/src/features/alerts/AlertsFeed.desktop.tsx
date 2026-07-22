import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Button } from "../../components/ui/Button";
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
 * Desktop BOX 13–14: a master–detail split, and a feed split into two tiers of visual weight. The
 * right pane exists so an alert can be judged without leaving the queue.
 */
export function AlertsFeedDesktop() {
  const { t } = useTranslation("adminAlerts");
  const navigate = useNavigate();
  const feed = useAlertsFeed();
  const { acknowledgement } = feed;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <Topbar
        title={t("feedTitle")}
        actions={
          <Button
            variant="textBrand"
            size="inline"
            onClick={feed.markRead}
            isLoading={feed.isMarkingRead}
          >
            {t("markRead")}
          </Button>
        }
      />
      <AlertsOfflineBanner
        isOnline={acknowledgement.isOnline}
        queuedCount={acknowledgement.queuedIds.length}
      />

      <PageMain>
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
                <FilterBar
                  label={t("filters.label")}
                  chips={severityChips(alerts, feed.severityFilter, t)}
                  onToggle={(id) => feed.setSeverityFilter(toSeverityFilter(id))}
                />

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
