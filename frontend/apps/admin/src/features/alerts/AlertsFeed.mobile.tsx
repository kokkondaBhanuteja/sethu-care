import { useNavigate } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { MobileAppBar } from "../../layouts/MobileAppBar";
import { MobileScroll } from "../../layouts/PageMain";
import { ROUTES } from "../../routes/routes.constants";
import { AlertNeedsActionSection } from "./AlertNeedsActionSection";
import { AlertNoticeList } from "./AlertNoticeList";
import { AlertSeverityChips } from "./AlertSeverityChips";
import { AllCaughtUpEmpty, AllCaughtUpStrip } from "./AlertsAllCaughtUp";
import { AlertsFeedSkeleton } from "./AlertsFeedSkeleton";
import { AlertsOfflineBanner } from "./AlertsOfflineBanner";
import { countUnacknowledgedCritical, splitTiers } from "./alerts.selectors";
import { useAlertsFeed } from "./useAlertsFeed";

/**
 * Mobile BOX 21–24. One screen, two tiers, and the gap between them is the entire design: a feed
 * that treats "a provider applied" and "a booking has no technician" as the same object is how the
 * second one gets missed. The severity chips mirror the desktop filter (same hook, same counts);
 * "Mark read" sits on the informational tier's own header, scoped to the only tier it can touch.
 */
export function AlertsFeedMobile() {
  const { t } = useTranslation("adminAlerts");
  const navigate = useNavigate();
  const feed = useAlertsFeed();
  const { acknowledgement } = feed;

  return (
    <>
      <MobileAppBar title={t("feedTitle")} />

      <AlertsOfflineBanner
        isOnline={acknowledgement.isOnline}
        queuedCount={acknowledgement.queuedIds.length}
      />

      <MobileScroll padFor="tabbar" className="pt-s3">
        <QueryBoundary
          query={feed.query}
          skeleton={
            <div className="px-s4">
              <AlertsFeedSkeleton />
            </div>
          }
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
                <AlertSeverityChips
                  alerts={alerts}
                  activeFilter={feed.severityFilter}
                  onFilterChange={feed.setSeverityFilter}
                  className="mb-s3 px-s4"
                />

                {tiers.needsAction.length > 0 ? (
                  <AlertNeedsActionSection
                    alerts={tiers.needsAction}
                    unacknowledgedCount={countUnacknowledgedCritical(alerts)}
                    acknowledgement={acknowledgement}
                    onSelect={(alert) => void navigate(ROUTES.alertDetail(alert.id))}
                    onOpenRecord={(route) => void navigate(route)}
                    inset
                  />
                ) : (
                  <div className="px-s4">
                    <AllCaughtUpStrip />
                  </div>
                )}

                <AlertNoticeList
                  today={tiers.noticesToday}
                  earlier={tiers.noticesEarlier}
                  inset
                  onMarkRead={feed.markRead}
                  isMarkingRead={feed.isMarkingRead}
                />
              </>
            );
          }}
        </QueryBoundary>
      </MobileScroll>
    </>
  );
}
