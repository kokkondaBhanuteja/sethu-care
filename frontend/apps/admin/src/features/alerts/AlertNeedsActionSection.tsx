import { useTranslation } from "@sethu/i18n";

import { Badge } from "../../components/ui/Badge";
import { CardList } from "../../components/ui/Card";
import { cx } from "../../lib/cx";
import { AlertActionCard } from "./AlertActionCard";
import { recordRouteFor } from "./alerts.links";
import type { Alert } from "./alerts.types";
import type { AcknowledgeController } from "./useAcknowledgeAlert";

export interface AlertNeedsActionSectionProps {
  alerts: readonly Alert[];
  /** Unacknowledged criticals only — the same number the Alerts badge shows (spec §3.1). */
  unacknowledgedCount: number;
  acknowledgement: AcknowledgeController;
  onSelect: (alert: Alert) => void;
  onOpenRecord: (route: string) => void;
  selectedId?: string | null;
  inset?: boolean;
}

/**
 * Tier one. The section is removed outright when it is empty rather than shown holding a zero: a
 * permanent container that is usually empty teaches the eye to skip the one region of the screen
 * that must never be skipped on the day it is not empty (mobile BOX 22).
 */
export function AlertNeedsActionSection({
  alerts,
  unacknowledgedCount,
  acknowledgement,
  onSelect,
  onOpenRecord,
  selectedId = null,
  inset = false,
}: AlertNeedsActionSectionProps) {
  const { t } = useTranslation("adminAlerts");

  return (
    <section aria-label={t("needsAction")} className={cx(inset && "px-s4")}>
      <div className="flex items-center gap-s2">
        <h2 className="text-pill tracking-wide text-danger uppercase">{t("needsAction")}</h2>
        <Badge count={unacknowledgedCount} label={t("needsAction")} />
      </div>

      <CardList className="mt-s2">
        {alerts.map((alert) => {
          const route = recordRouteFor(alert.subject);
          return (
            <AlertActionCard
              key={alert.id}
              alert={alert}
              selected={selectedId === alert.id}
              canAcknowledge={acknowledgement.canAcknowledge}
              isQueued={acknowledgement.isQueued(alert.id)}
              isSending={acknowledgement.isSending(alert.id)}
              onSelect={() => onSelect(alert)}
              onAcknowledge={() => acknowledgement.acknowledge(alert.id)}
              {...(route ? { onOpenRecord: () => onOpenRecord(route) } : {})}
            />
          );
        })}
      </CardList>

      {/* The contract that makes "Mark read" safe: it can only ever touch tier two. */}
      <p className="mt-s3 text-caption text-text-3">{t("criticalStay")}</p>
    </section>
  );
}
