import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { NotFoundState } from "../../components/ui/states/NotFoundState";
import { MobileAppBar } from "../../layouts/MobileAppBar";
import { MobileScroll } from "../../layouts/PageMain";
import { AlertDetailActions } from "./AlertDetailActions";
import { AlertDetailMobileBody } from "./AlertDetailMobileBody";
import { AlertDetailSkeleton } from "./AlertDetailSkeleton";
import { AlertsOfflineBanner } from "./AlertsOfflineBanner";
import type { Alert } from "./alerts.types";
import { useAlertDetail } from "./useAlertDetail";

export interface AlertDetailMobileProps {
  alertId: string;
}

/** No bar at all rather than an empty one, when the alert offers nothing to do from here. */
function hasFooterAction(alert: Alert): boolean {
  return alert.requiresAcknowledgement || alert.subject !== null;
}

/**
 * Mobile BOX 38–40. `/alerts/:id` is a push-notification target, so an unknown or deleted id must
 * render the not-found state rather than crash (spec §3.4 rule 3).
 */
export function AlertDetailMobile({ alertId }: AlertDetailMobileProps) {
  const { t } = useTranslation("adminAlerts");
  const detail = useAlertDetail(alertId);
  const { acknowledgement } = detail;

  if (detail.isNotFound) {
    return (
      <>
        <MobileAppBar title={t("detailTitle")} showBack compact bordered />
        <MobileScroll>
          <NotFoundState subject={t("notFoundSubject")} />
        </MobileScroll>
      </>
    );
  }

  return (
    <>
      <MobileAppBar title={t("detailTitle")} showBack compact bordered />
      <AlertsOfflineBanner
        isOnline={acknowledgement.isOnline}
        queuedCount={acknowledgement.queuedIds.length}
      />

      <MobileScroll padFor="action">
        <QueryBoundary
          query={detail.query}
          skeleton={
            <div className="p-s4">
              <AlertDetailSkeleton />
            </div>
          }
          grow
        >
          {(alert) => (
            <AlertDetailMobileBody
              alert={alert}
              onAddNote={detail.addNote}
              isAddingNote={detail.isAddingNote}
            />
          )}
        </QueryBoundary>
      </MobileScroll>

      {detail.query.data && hasFooterAction(detail.query.data) ? (
        <div className="shrink-0 border-t border-border-subtle bg-canvas px-s4 py-s3">
          {/* Equal columns for however many actions this alert's state offers. */}
          <div className="grid auto-cols-fr grid-flow-col gap-s2">
            <AlertDetailActions alert={detail.query.data} acknowledgement={acknowledgement} />
          </div>
        </div>
      ) : null}
    </>
  );
}
