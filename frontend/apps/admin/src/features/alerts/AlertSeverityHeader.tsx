import type { ReactNode } from "react";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { Pill } from "../../components/ui/Pill";
import { formatRelative, formatTime } from "../../lib/format";
import {
  ALERT_TYPE_ICONS,
  SEVERITY_CARD_EDGES,
  SEVERITY_HEADER_TONES,
  SEVERITY_INK,
  SEVERITY_LABEL_KEYS,
  SEVERITY_PILL_TONES,
} from "./alerts.constants";
import type { Alert } from "./alerts.types";
import { useAlertTitle } from "./useAlertTitle";

export interface AlertSeverityHeaderProps {
  alert: Alert;
  /** Desktop puts Acknowledge / Assign / Open beside the identity instead of in a sticky footer. */
  actions?: ReactNode;
}

/**
 * The alert's whole identity in one block (BOX 22–23, 38–40).
 *
 * Acknowledging lowers the temperature without lowering the severity: the tint drops to neutral, but
 * the 3px rail and the CRITICAL pill STAY. Severity is a property of the alert; acknowledgement is a
 * fact about who is reading it. Draining the red entirely would say "resolved" — exactly the
 * confusion the Ownership block exists to prevent.
 */
export function AlertSeverityHeader({ alert, actions }: AlertSeverityHeaderProps) {
  const { t } = useTranslation("adminAlerts");
  const titleOf = useAlertTitle();
  const isOwned = alert.acknowledgement !== null;

  return (
    <Card
      tone={isOwned ? "surface" : SEVERITY_HEADER_TONES[alert.severity]}
      edge={SEVERITY_CARD_EDGES[alert.severity]}
    >
      <div className="flex flex-wrap items-start gap-s3">
        <div className="grow">
          <div className="flex items-center gap-s3">
            <Icon
              glyph={ALERT_TYPE_ICONS[alert.type]}
              size="xl"
              className={SEVERITY_INK[alert.severity]}
            />
            <Pill tone={SEVERITY_PILL_TONES[alert.severity]} onTint>
              {t(SEVERITY_LABEL_KEYS[alert.severity])}
            </Pill>
          </div>

          <h1 className="mt-s3 mb-0 text-title text-text-1">{titleOf(alert)}</h1>
          <p className="mt-s1 mb-0 text-label text-text-2">
            {t("meta.created", {
              time: formatTime(alert.createdAt),
              age: formatRelative(alert.createdAt),
            })}
          </p>

          <div className="mt-s3">{statusPill(alert, isOwned, t)}</div>
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap gap-s2">{actions}</div> : null}
      </div>
    </Card>
  );
}

type Translate = ReturnType<typeof useTranslation<"adminAlerts">>["t"];

function statusPill(alert: Alert, isOwned: boolean, t: Translate) {
  if (!alert.requiresAcknowledgement) {
    return (
      <Pill tone="neutral" icon={Info} onTint>
        {t("status.noActionRequired")}
      </Pill>
    );
  }
  if (isOwned) {
    return (
      <Pill tone="success" icon={CheckCircle2} onTint>
        {t("status.acknowledged")}
      </Pill>
    );
  }
  return (
    <Pill tone="danger" icon={TriangleAlert} onTint>
      {t("status.unacknowledged")}
    </Pill>
  );
}
