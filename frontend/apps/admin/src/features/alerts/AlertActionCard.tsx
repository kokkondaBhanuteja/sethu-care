import { Clock, UserCheck } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { IconChip } from "@sethu/ui-web";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { cx } from "../../lib/cx";
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
 * Acknowledging is claiming, not resolving: the card keeps its tint, its text stays readable (a
 * gentle de-emphasis, never a wash-out), and Open stays live — going to the record is exactly what
 * acknowledging commits the operator to. Only the Acknowledge slot changes, into the owner's name.
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
    <Card tone={SEVERITY_CARD_TINTS[alert.severity]} selected={selected}>
      <button
        type="button"
        onClick={onSelect}
        className={cx("block w-full cursor-pointer text-left", owner && "opacity-70")}
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

      {owner ? (
        <div className="mt-s3 flex items-center justify-between gap-s2">
          <span className="flex min-w-0 items-center gap-s1 text-caption text-success">
            <Icon glyph={UserCheck} size="sm" />
            <span className="truncate">
              {t("status.acknowledgedBy", { name: owner.adminName })}
            </span>
          </span>
          <Button variant="outline" size="inline" onClick={onOpenRecord} disabled={!onOpenRecord}>
            {t("actions.open")}
          </Button>
        </div>
      ) : (
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
              disabled={!canAcknowledge}
              isLoading={isSending}
            >
              {t("actions.acknowledge")}
            </Button>
          )}
          <Button variant="outline" size="inline" onClick={onOpenRecord} disabled={!onOpenRecord}>
            {t("actions.open")}
          </Button>
        </div>
      )}
    </Card>
  );
}
