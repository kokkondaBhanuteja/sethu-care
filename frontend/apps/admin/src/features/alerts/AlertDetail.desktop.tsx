import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { NotFoundState } from "../../components/ui/states/NotFoundState";
import { PageMain } from "../../layouts/PageMain";
import { Topbar } from "../../layouts/Topbar";
import { ROUTES } from "../../routes/routes.constants";
import { AlertDetailActions } from "./AlertDetailActions";
import { AlertDetailDesktopAside } from "./AlertDetailDesktopAside";
import { AlertDetailDesktopMain } from "./AlertDetailDesktopMain";
import { AlertDetailSkeleton } from "./AlertDetailSkeleton";
import { AlertSeverityHeader } from "./AlertSeverityHeader";
import { AlertsOfflineBanner } from "./AlertsOfflineBanner";
import { useAlertDetail } from "./useAlertDetail";
import { useAlertTitle } from "./useAlertTitle";

export interface AlertDetailDesktopProps {
  alertId: string;
}

/** Desktop BOX 22–23. */
export function AlertDetailDesktop({ alertId }: AlertDetailDesktopProps) {
  const { t } = useTranslation("adminAlerts");
  const titleOf = useAlertTitle();
  const detail = useAlertDetail(alertId);
  const { acknowledgement } = detail;
  const alert = detail.query.data;

  const crumbs = [
    { label: t("feedTitle"), to: ROUTES.alerts },
    { label: alert ? titleOf(alert) : t("detailTitle") },
  ];

  if (detail.isNotFound) {
    return (
      <>
        <Topbar crumbs={crumbs} />
        <PageMain>
          <NotFoundState subject={t("notFoundSubject")} />
        </PageMain>
      </>
    );
  }

  return (
    <>
      <Topbar crumbs={crumbs} />
      <AlertsOfflineBanner
        isOnline={acknowledgement.isOnline}
        queuedCount={acknowledgement.queuedIds.length}
      />

      <PageMain>
        <QueryBoundary query={detail.query} skeleton={<AlertDetailSkeleton />} grow>
          {(loaded) => (
            <>
              <AlertSeverityHeader
                alert={loaded}
                actions={
                  <AlertDetailActions
                    alert={loaded}
                    acknowledgement={acknowledgement}
                    size="inline"
                    includeOpenRecord
                  />
                }
              />

              <div className="mt-s6 flex flex-col items-start gap-s6 shell:flex-row">
                <div className="min-w-0 grow shell:basis-3/5">
                  <AlertDetailDesktopMain
                    alert={loaded}
                    onAddNote={detail.addNote}
                    isAddingNote={detail.isAddingNote}
                  />
                </div>
                <div className="min-w-0 grow shell:basis-2/5">
                  <AlertDetailDesktopAside alert={loaded} />
                </div>
              </div>
            </>
          )}
        </QueryBoundary>
      </PageMain>
    </>
  );
}
