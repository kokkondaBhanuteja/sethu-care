import { useTranslation } from "@sethu/i18n";

import { DataTable } from "../../components/ui/DataTable";
import { PRIORITY_PRESENTATION } from "./dashboard.constants";
import type { AttentionItem } from "./dashboard.types";
import { buildAttentionColumns } from "./needsAttentionColumns";
import { usePriorityLabel } from "./usePriorityLabel";
import type { AttentionPermissions } from "./useNeedsAttention";
import type { AcknowledgeController } from "./useAcknowledgeAlert";

export interface NeedsAttentionTableProps {
  /**
   * The window of rows to draw. Kept as a plain array prop — no internal fetching, no scroll
   * ownership, no measurement — so a windowing library can wrap this component unchanged if the
   * queue ever exceeds the point where every row belongs in the DOM (spec §2.4).
   */
  items: readonly AttentionItem[];
  permissions: AttentionPermissions;
  isBlocked: boolean;
  acknowledgement: AcknowledgeController;
  /** The dashboard panel drops Customer and Reason; the feed is the full nine-column queue. */
  variant: "compact" | "full";
}

/**
 * Desktop's rendering of the queue: a TABLE, not cards. That is the whole point of the wider
 * canvas — an ops manager scans the AGE and PROVIDER columns down the page to find the worst
 * problem, which stacked cards make impossible. Mobile renders the same records through
 * `NeedsAttentionCards.mobile`, over the same `useNeedsAttention()` hook.
 *
 * Rows are ordered by priority and never by time, and the feed says so beneath the table: a queue
 * that looks chronological and is not will be misread once and then distrusted forever (#B-8811 at
 * 34 minutes correctly sits below #B-8823 at 12).
 */
export function NeedsAttentionTable({
  items,
  permissions,
  isBlocked,
  acknowledgement,
  variant,
}: NeedsAttentionTableProps) {
  const { t } = useTranslation("adminDashboard");
  const priorityLabel = usePriorityLabel();

  return (
    <DataTable
      caption={t("attention.tableCaption")}
      columns={buildAttentionColumns({
        t,
        priorityLabel,
        permissions,
        isBlocked,
        acknowledgement,
        variant,
      })}
      rows={items}
      rowKey={(row) => row.alertId}
      // The rail and the faint tint mark ESCALATED only: SLA-breached is red and urgent, but
      // escalated means the automation has already given up.
      rowTone={(row) => (PRIORITY_PRESENTATION[row.priority].severeEdge ? "danger" : "default")}
      density="dense"
    />
  );
}
