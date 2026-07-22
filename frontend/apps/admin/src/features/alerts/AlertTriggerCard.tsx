import { Gauge } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";
import { CardContent, CardHeader, IconChip } from "@sethu/ui-web";

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
 * The rule audit as an info-tinted Card, and the reason this screen exists (spec §6.21). An alert
 * that only says "escalated" invites the manager to argue with it; one that shows the rule, the
 * threshold and the actual measurement as a definition list lets her see in two seconds whether
 * the system is right — and the footnote sends her to the setting when it is not, rather than
 * teaching her to ignore the alert.
 */
export function AlertTriggerCard({
  trigger,
  severity,
  columns = false,
  showHeading = true,
}: AlertTriggerCardProps) {
  const { t } = useTranslation("adminAlerts");
  // The reading is the number that crossed the line; it is inked red only when a line was crossed.
  const actualInk = severity === ALERT_SEVERITIES.informational ? "text-ink" : "text-danger";

  return (
    <div>
      <Card tone="info" density="flush">
        {showHeading ? (
          <CardHeader
            icon={
              <IconChip accent="blue" look="solid">
                <Gauge aria-hidden />
              </IconChip>
            }
          >
            {t("trigger.heading")}
          </CardHeader>
        ) : null}

        <CardContent className={cx(!showHeading && "pt-4 sm:pt-5")}>
          <dl className={cx("grid gap-3", columns && "shell:grid-cols-3")}>
            <div>
              <dt className="text-xs text-muted">{t("trigger.rule")}</dt>
              <dd className="m-0 text-sm font-semibold text-ink">{trigger.rule}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t("trigger.threshold")}</dt>
              <dd className="m-0 font-mono text-mono tabular-nums text-ink">{trigger.threshold}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t("trigger.actual")}</dt>
              <dd className={cx("m-0 font-mono text-mono tabular-nums", actualInk)}>
                {trigger.actual}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <p className="mb-0 mt-2 text-xs text-faint">{t("trigger.settingsNote")}</p>
      <Link className="text-xs text-link" to={ROUTES.notificationSettings}>
        {t("trigger.settingsLink")}
      </Link>
    </div>
  );
}
