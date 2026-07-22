import { Clock } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { assignRouteFor, recordRouteFor } from "./alerts.links";
import type { Alert } from "./alerts.types";
import type { AcknowledgeController } from "./useAcknowledgeAlert";

export interface AlertDetailActionsProps {
  alert: Alert;
  acknowledgement: AcknowledgeController;
  /** The sticky mobile footer uses 48px controls; the desktop identity strip uses 36px. */
  size?: "inline" | "primary";
  /**
   * Desktop repeats "Open booking" in the identity strip; mobile does not, because the related-record
   * card is two thumb-lengths away and a third footer button would shrink all three.
   */
  includeOpenRecord?: boolean;
}

/**
 * The alert's contextual actions. Acknowledging is the only thing this screen does itself —
 * everything else navigates to the feature that owns the record (spec §6.21).
 *
 * Once acknowledged, the fix becomes the filled primary: it is the only thing left to do.
 */
export function AlertDetailActions({
  alert,
  acknowledgement,
  size = "primary",
  includeOpenRecord = false,
}: AlertDetailActionsProps) {
  const { t } = useTranslation("adminAlerts");
  const navigate = useNavigate();

  const recordRoute = recordRouteFor(alert.subject);
  const assignRoute = assignRouteFor(alert.subject);
  const isOwned = alert.acknowledgement !== null;
  const needsOwner = alert.requiresAcknowledgement && !isOwned;

  // An informational alert offers no ownership at all: offering it would dilute what acknowledging
  // means on the alerts that matter (mobile BOX 40).
  if (!alert.requiresAcknowledgement) {
    return recordRoute ? (
      <Button variant="outline" size={size} onClick={() => void navigate(recordRoute)}>
        {t("actions.openBooking")}
      </Button>
    ) : null;
  }

  return (
    <>
      {needsOwner ? acknowledgeControl(alert, acknowledgement, size, t) : null}
      {assignRoute ? (
        <Button
          variant={isOwned ? "primary" : "outline"}
          size={size}
          onClick={() => void navigate(assignRoute)}
        >
          {t("actions.assignProvider")}
        </Button>
      ) : null}
      {includeOpenRecord && recordRoute ? (
        <Button variant="outline" size={size} onClick={() => void navigate(recordRoute)}>
          {t("actions.openBooking")}
        </Button>
      ) : null}
    </>
  );
}

type Translate = ReturnType<typeof useTranslation<"adminAlerts">>["t"];

/** Queued is not a disabled button: the tap landed and is waiting on the network (BOX 24). */
function acknowledgeControl(
  alert: Alert,
  acknowledgement: AcknowledgeController,
  size: "inline" | "primary",
  t: Translate,
) {
  if (acknowledgement.isQueued(alert.id)) {
    return (
      <span className="flex h-btn-48 items-center justify-center gap-s1 rounded-pill border border-border-subtle">
        <Icon glyph={Clock} size="sm" className="text-warning" />
        <span className="text-caption text-warning">{t("actions.queued")}</span>
      </span>
    );
  }

  return (
    <Button
      variant="primary"
      size={size}
      disabled={!acknowledgement.canAcknowledge}
      isLoading={acknowledgement.isSending(alert.id)}
      onClick={() => acknowledgement.acknowledge(alert.id)}
    >
      {t("actions.acknowledge")}
    </Button>
  );
}
