import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Card } from "../../components/ui/Card";
import { cx } from "../../lib/cx";
import { ROUTES } from "../../routes/routes.constants";
import { ALERT_SEVERITIES, type AlertSeverity, type AlertTrigger } from "./alerts.types";

export interface AlertTriggerCardProps {
  trigger: AlertTrigger;
  severity: AlertSeverity;
  /** Desktop sets the three readings side by side so threshold and actual compare at a glance. */
  columns?: boolean;
  /** The preview pane already has a heading above it. */
  showHeading?: boolean;
}

/**
 * The rule audit, and the reason this screen exists (spec §6.21). An alert that only says
 * "escalated" invites the manager to argue with it; one that shows the rule, the threshold and the
 * actual measurement lets her see in two seconds whether the system is right — and the footnote
 * sends her to the setting when it is not, rather than teaching her to ignore the alert.
 */
export function AlertTriggerCard({
  trigger,
  severity,
  columns = false,
  showHeading = true,
}: AlertTriggerCardProps) {
  const { t } = useTranslation("adminAlerts");
  // The reading is the number that crossed the line; it is inked red only when a line was crossed.
  const actualInk = severity === ALERT_SEVERITIES.informational ? "text-text-1" : "text-danger";

  return (
    <div>
      <Card tone="surface">
        {showHeading ? (
          <h3 className="mb-s3 text-pill tracking-wide text-text-2 uppercase">
            {t("trigger.heading")}
          </h3>
        ) : null}

        <dl className={cx("grid gap-s3", columns && "shell:grid-cols-3")}>
          <div>
            <dt className="text-caption text-text-3">{t("trigger.rule")}</dt>
            <dd className="m-0 text-label font-semibold text-text-1">{trigger.rule}</dd>
          </div>
          <div>
            <dt className="text-caption text-text-3">{t("trigger.threshold")}</dt>
            <dd className="m-0 font-mono text-mono text-text-1 tabular-nums">
              {trigger.threshold}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-text-3">{t("trigger.actual")}</dt>
            <dd className={cx("m-0 font-mono text-mono tabular-nums", actualInk)}>
              {trigger.actual}
            </dd>
          </div>
        </dl>
      </Card>

      <p className="mt-s2 mb-0 text-caption text-text-3">{t("trigger.settingsNote")}</p>
      <Link className="text-caption text-brand" to={ROUTES.notificationSettings}>
        {t("trigger.settingsLink")}
      </Link>
    </div>
  );
}
