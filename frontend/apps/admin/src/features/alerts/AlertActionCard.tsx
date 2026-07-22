import { Clock, UserCheck } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { IconChip } from "@sethu/ui-web";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { Pill } from "../../components/ui/Pill";
import { formatRelative } from "../../lib/format";
import { ALERT_TYPE_ICONS, SEVERITY_CARD_TINTS, SEVERITY_INK } from "./alerts.constants";
import type { Alert } from "./alerts.types";
import { useAlertTitle } from "./useAlertTitle";

export interface AlertActionCardProps {
  alert: Alert;
  /** Opens the alert itself — the detail screen on mobile, the preview pane on desktop. */
  onSelect: () => void;
  /** Opens the record the alert is about. Absent when the alert names no record. */
  onOpenRecord?: () => void;
  onAcknowledge: () => void;
  canAcknowledge: boolean;
  isQueued: boolean;
  isSending: boolean;
  selected?: boolean;
}

/**
 * Tier one: a severity edge, a faint tint, a real decision. This is the only object in the feed with
 * a card, a tint or a button, and that contrast against the bare informational rows is the whole
 * design — two alerts need a decision and five do not (spec §6.20).
 *
 * An acknowledged card stays in tier one and fades toward the tier below rather than vanishing: a
 * card that simply disappeared reads as a bug, or as the operator's own mis-tap.
 */
export function AlertActionCard({
  alert,
  onSelect,
  onOpenRecord,
  onAcknowledge,
  canAcknowledge,
  isQueued,
  isSending,
  selected = false,
}: AlertActionCardProps) {
  const { t } = useTranslation("adminAlerts");
  const titleOf = useAlertTitle();
  const owner = alert.acknowledgement;

  return (
    <div className="relative">
      <Card
        tone={SEVERITY_CARD_TINTS[alert.severity]}
        selected={selected}
        className={owner ? "opacity-40" : undefined}
      >
        <button
          type="button"
          onClick={onSelect}
          className="block w-full cursor-pointer text-left"
          aria-current={selected ? "true" : undefined}
        >
          <span className="flex items-center gap-s3">
            <IconChip
              look="soft"
              size="sm"
              accent={alert.severity === "critical" ? "red" : "amber"}
              className="bg-surface"
            >
              <Icon glyph={ALERT_TYPE_ICONS[alert.type]} className={SEVERITY_INK[alert.severity]} />
            </IconChip>
            <span className="grow text-emph text-text-1">{titleOf(alert)}</span>
            <span className="shrink-0 text-caption text-text-3">
              {formatRelative(alert.createdAt)}
            </span>
          </span>
          <span className="mt-s1 block text-label text-text-2">{alert.summary}</span>
        </button>

        <div className="mt-s3 grid grid-cols-2 gap-s2">
          {isQueued ? (
            // Not a disabled button: the tap landed, it is waiting on the network, and saying so is
            // what stops her tapping it four more times (mobile BOX 24).
            <span className="flex h-btn-36 items-center justify-center gap-s1 rounded-pill border border-border-subtle">
              <Icon glyph={Clock} size="sm" className="text-warning" />
              <span className="text-caption text-warning">{t("actions.queued")}</span>
            </span>
          ) : (
            <Button
              variant="primary"
              size="inline"
              onClick={onAcknowledge}
              disabled={!canAcknowledge || owner !== null}
              isLoading={isSending}
            >
              {t("actions.acknowledge")}
            </Button>
          )}
          <Button
            variant="outline"
            size="inline"
            onClick={onOpenRecord}
            disabled={!onOpenRecord || owner !== null}
          >
            {t("actions.open")}
          </Button>
        </div>
      </Card>

      {owner ? (
        <Pill
          tone="info"
          icon={UserCheck}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          {t("status.acknowledgedBy", { name: owner.adminName })}
        </Pill>
      ) : null}
    </div>
  );
}
