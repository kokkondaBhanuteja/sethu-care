import { Bell } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Pill } from "../../components/ui/Pill";
import { NotFoundState } from "../../components/ui/states/NotFoundState";
import { formatRelative, formatTime } from "../../lib/format";
import { ROUTES } from "../../routes/routes.constants";
import { AlertDetailActions } from "./AlertDetailActions";
import { AlertDetailSkeleton } from "./AlertDetailSkeleton";
import { AlertRelatedAlerts } from "./AlertRelatedAlerts";
import { AlertTriggerCard } from "./AlertTriggerCard";
import { SEVERITY_LABEL_KEYS, SEVERITY_PILL_TONES } from "./alerts.constants";
import { useAlertDetail } from "./useAlertDetail";
import { useAlertTitle } from "./useAlertTitle";

export function AlertPreviewEmpty() {
  const { t } = useTranslation("adminAlerts");

  return (
    <Card>
      <EmptyState icon={Bell} title={t("selectAlert")} grow />
    </Card>
  );
}

export interface AlertPreviewProps {
  alertId: string;
}

/**
 * Desktop BOX 13's right pane: an alert judged without leaving the queue. The rule, its threshold and
 * the actual reading sit together, which is what turns "why did this fire?" into a two-second answer.
 */
export function AlertPreview({ alertId }: AlertPreviewProps) {
  const { t } = useTranslation("adminAlerts");
  const titleOf = useAlertTitle();
  const detail = useAlertDetail(alertId);

  if (detail.isNotFound) {
    return (
      <Card>
        <NotFoundState subject={t("notFoundSubject")} grow={false} />
      </Card>
    );
  }

  return (
    <Card>
      <QueryBoundary query={detail.query} skeleton={<AlertDetailSkeleton />}>
        {(alert) => (
          <div className="flex flex-col gap-s4">
            <div>
              <Pill tone={SEVERITY_PILL_TONES[alert.severity]}>
                {t(SEVERITY_LABEL_KEYS[alert.severity])}
              </Pill>
              <h2 className="mt-s2 mb-0 text-section text-text-1">
                <Link className="text-text-1 no-underline" to={ROUTES.alertDetail(alert.id)}>
                  {titleOf(alert)}
                </Link>
              </h2>
              <p className="mt-s1 mb-0 text-label text-text-2">
                {alert.requiresAcknowledgement && !alert.acknowledgement
                  ? t("meta.createdUnacknowledged", {
                      time: formatTime(alert.createdAt),
                      age: formatRelative(alert.createdAt),
                    })
                  : t("meta.created", {
                      time: formatTime(alert.createdAt),
                      age: formatRelative(alert.createdAt),
                    })}
              </p>
            </div>

            <AlertTriggerCard trigger={alert.trigger} severity={alert.severity} />

            {alert.relatedRecord ? (
              <Card tone="surface">
                <p className="m-0 flex flex-wrap items-center gap-s2 text-label text-text-2">
                  <span className="font-mono text-mono text-brand tabular-nums">
                    {alert.relatedRecord.reference}
                  </span>
                  <span>· {alert.relatedRecord.title}</span>
                  <span>· {alert.relatedRecord.subtitle}</span>
                </p>
              </Card>
            ) : null}

            <div className="flex flex-wrap gap-s2">
              <AlertDetailActions
                alert={alert}
                acknowledgement={detail.acknowledgement}
                size="inline"
                includeOpenRecord
              />
            </div>

            <AlertRelatedAlerts alerts={alert.relatedAlerts} />
          </div>
        )}
      </QueryBoundary>
    </Card>
  );
}
