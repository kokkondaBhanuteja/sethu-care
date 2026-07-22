import { Check } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Card } from "../../components/ui/Card";
import { Pill } from "../../components/ui/Pill";
import { cx } from "../../lib/cx";
import { formatAge, formatMoney, formatTime } from "../../lib/format";
import { PRIORITY_PRESENTATION } from "./dashboard.constants";
import type { AttentionItem } from "./dashboard.types";
import { AttentionActions } from "./AttentionActions";
import { usePriorityLabel } from "./usePriorityLabel";
import type { AttentionPermissions } from "./useNeedsAttention";

export interface AttentionCardProps {
  item: AttentionItem;
  permissions: AttentionPermissions;
  isBlocked: boolean;
  /** True while the row is leaving after an acknowledgement. */
  isResolving: boolean;
  onAcknowledge: () => void;
}

/**
 * Mobile's rendering of one queue record. The reason is the only coloured line — everything above it
 * merely identifies the job, and the reason is what tells the manager which button to press.
 *
 * The 3px severity edge marks ESCALATED only: an SLA breach is red and urgent, but escalated means
 * the automation has already given up.
 */
export function AttentionCard({
  item,
  permissions,
  isBlocked,
  isResolving,
  onAcknowledge,
}: AttentionCardProps) {
  const { t } = useTranslation("adminDashboard");
  const priorityLabel = usePriorityLabel();
  const presentation = PRIORITY_PRESENTATION[item.priority];

  return (
    <Card
      edge={presentation.severeEdge ? "danger" : "none"}
      // Leaves over 240ms rather than vanishing under the thumb, so the operator can see which
      // card went and is not left wondering whether they pressed the wrong one (spec §6.6).
      className={cx(
        "relative transition-all",
        isResolving && "translate-x-s8 opacity-60 pointer-events-none",
      )}
      aria-busy={isResolving || undefined}
    >
      {isResolving ? (
        <span className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 shadow-card">
          <Pill tone="success" icon={Check}>
            {t("attention.resolved")}
          </Pill>
        </span>
      ) : null}

      <div className="flex items-center justify-between gap-s3">
        <div className="flex items-center gap-s2 min-w-0">
          <Pill tone={presentation.tone} icon={presentation.icon}>
            {priorityLabel(item.priority)}
          </Pill>
          <span className="font-mono text-mono tabular-nums text-text-2">{item.bookingRef}</span>
        </div>
        <span className="text-caption text-text-3 flex-none">{formatAge(item.surfacedAt)}</span>
      </div>

      <p className="text-emph text-text-1 mt-s2">
        {t("attention.summary", { service: item.service, customer: item.customerName })}
      </p>
      <p className="text-label text-text-2">
        {t("attention.meta", {
          area: item.area,
          time: formatTime(item.slotAt),
          amount: formatMoney(item.amountPaise),
        })}
      </p>
      <p
        className={cx(
          "text-label font-medium mt-s1",
          presentation.tone === "danger" ? "text-danger" : "text-warning",
        )}
      >
        {item.reason}
      </p>

      <div className="mt-s3">
        <AttentionActions
          item={item}
          permissions={permissions}
          isBlocked={isBlocked || isResolving}
          onAcknowledge={onAcknowledge}
          emphasiseAcknowledge
        />
      </div>
    </Card>
  );
}
