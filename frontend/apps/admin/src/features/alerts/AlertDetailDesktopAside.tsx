import { useTranslation } from "@sethu/i18n";

import { Card } from "../../components/ui/Card";
import { Timeline, type TimelineEntry } from "../../components/ui/Timeline";
import { AlertOwnership } from "./AlertOwnership";
import { AlertRelatedAlerts } from "./AlertRelatedAlerts";
import { AlertRelatedRecord } from "./AlertRelatedRecord";
import { formatAlertTime } from "./alerts.time";
import { ALERT_SEVERITIES, type AlertDetail } from "./alerts.types";

export interface AlertDetailDesktopAsideProps {
  alert: AlertDetail;
}

/** Desktop BOX 22, right column: the record, the ownership, the neighbours. */
export function AlertDetailDesktopAside({ alert }: AlertDetailDesktopAsideProps) {
  const { t } = useTranslation("adminAlerts");

  const entries: readonly TimelineEntry[] = alert.history.map((entry) => ({
    id: entry.id,
    time: formatAlertTime(entry.at),
    tone: entry.tone,
    emphasis: entry.tone === "danger" ? "danger" : "strong",
    body: entry.body,
  }));

  return (
    <div className="flex flex-col gap-s5">
      {alert.relatedRecord ? (
        <section aria-label={t("relatedRecord")}>
          <h2 className="mb-s2 text-pill tracking-wide text-text-2 uppercase">
            {t("relatedRecord")}
          </h2>
          <AlertRelatedRecord
            record={alert.relatedRecord}
            showEdge={alert.severity !== ALERT_SEVERITIES.informational}
          />
          {entries.length > 0 ? (
            <Card className="mt-s3">
              <h3 className="mb-s3 text-pill tracking-wide text-text-2 uppercase">
                {t("dispatchHistory")}
              </h3>
              <Timeline label={t("dispatchHistory")} entries={entries} />
            </Card>
          ) : null}
        </section>
      ) : null}

      <Card>
        <h2 className="mb-s3 text-pill tracking-wide text-text-2 uppercase">
          {t("ownership.heading")}
        </h2>
        <AlertOwnership alert={alert} />
      </Card>

      <AlertRelatedAlerts alerts={alert.relatedAlerts} />
    </div>
  );
}
