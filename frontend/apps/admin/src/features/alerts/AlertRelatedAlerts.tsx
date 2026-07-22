import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Icon } from "../../components/ui/Icon";
import { StatusDot } from "../../components/ui/StatusDot";
import { ROUTES } from "../../routes/routes.constants";
import { SEVERITY_LABEL_KEYS } from "./alerts.constants";
import { formatAlertTime } from "./alerts.time";
import type { RelatedAlertLink } from "./alerts.types";
import { useAlertTitle } from "./useAlertTitle";

export interface AlertRelatedAlertsProps {
  alerts: readonly RelatedAlertLink[];
}

const DOT_TONES = {
  critical: "danger",
  warning: "warning",
  informational: "neutral",
} as const;

/** The neighbours on the same record — an alert rarely fires alone (spec §6.21). */
export function AlertRelatedAlerts({ alerts }: AlertRelatedAlertsProps) {
  const { t } = useTranslation("adminAlerts");
  const titleOf = useAlertTitle();

  if (alerts.length === 0) return null;

  return (
    <section aria-label={t("relatedAlerts")}>
      <h3 className="mb-s1 text-pill tracking-wide text-text-2 uppercase">{t("relatedAlerts")}</h3>
      {alerts.map((alert) => (
        <Link
          key={alert.id}
          to={ROUTES.alertDetail(alert.id)}
          className="flex min-h-row-48 items-center gap-s3 border-b border-border-subtle no-underline transition-colors hover:bg-inset"
        >
          {/* The dot carries an sr-only severity word — colour never signals alone (spec §4.8). */}
          <StatusDot
            tone={DOT_TONES[alert.severity]}
            label={t(SEVERITY_LABEL_KEYS[alert.severity])}
          />
          <span className="grow truncate text-label text-text-1">{titleOf(alert)}</span>
          <span className="shrink-0 text-caption text-text-3">
            {formatAlertTime(alert.createdAt)}
          </span>
          <Icon glyph={ChevronRight} className="shrink-0 text-text-3" />
        </Link>
      ))}
    </section>
  );
}
