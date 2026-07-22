import { Check } from "lucide-react";
import type { TFunction } from "i18next";

import { Pill } from "../../components/ui/Pill";
import { TableActions } from "../../components/ui/DataTable";
import type { DataTableColumn } from "../../components/ui/DataTable";
import { cx } from "../../lib/cx";
import { formatAge } from "../../lib/format";
import { PRIORITY_PRESENTATION } from "./dashboard.constants";
import type { AttentionItem, AttentionPriority } from "./dashboard.types";
import { AttentionActions } from "./AttentionActions";
import type { AttentionPermissions } from "./useNeedsAttention";
import type { AcknowledgeController } from "./useAcknowledgeAlert";

type Translate = TFunction<"adminDashboard">;
type Column = DataTableColumn<AttentionItem>;

export interface ColumnFactoryInput {
  readonly t: Translate;
  readonly priorityLabel: (priority: AttentionPriority) => string;
  readonly permissions: AttentionPermissions;
  readonly isBlocked: boolean;
  readonly acknowledgement: AcknowledgeController;
  /** The dashboard panel drops Customer and Reason; the feed is the full nine-column queue. */
  readonly variant: "compact" | "full";
}

const MONO_CELL = "font-mono text-mono tabular-nums whitespace-nowrap";

/** The reason is the only cell carrying the status colour — it is the diagnosis (spec §6.6). */
function reasonTone(priority: AttentionPriority): string {
  return PRIORITY_PRESENTATION[priority].tone === "danger" ? "text-danger-fg" : "text-warning-fg";
}

export function buildAttentionColumns(input: ColumnFactoryInput): readonly Column[] {
  const { t, priorityLabel, permissions, isBlocked, acknowledgement, variant } = input;
  const isFull = variant === "full";

  const priority: Column = {
    id: "priority",
    header: t("columns.priority"),
    render: (row) =>
      acknowledgement.resolvingIds.has(row.alertId) ? (
        <Pill tone="success" icon={Check}>
          {t("attention.resolved")}
        </Pill>
      ) : (
        <Pill
          tone={PRIORITY_PRESENTATION[row.priority].tone}
          icon={PRIORITY_PRESENTATION[row.priority].icon}
        >
          {priorityLabel(row.priority)}
        </Pill>
      ),
  };

  const booking: Column = {
    id: "booking",
    header: t("columns.booking"),
    cellClassName: MONO_CELL,
    render: (row) => row.bookingRef,
  };

  const service: Column = {
    id: "service",
    header: t("columns.service"),
    render: (row) => row.service,
  };
  const customer: Column = {
    id: "customer",
    header: t("columns.customer"),
    cellClassName: "whitespace-nowrap",
    render: (row) => row.customerName,
  };
  const area: Column = { id: "area", header: t("columns.area"), render: (row) => row.area };
  const reason: Column = {
    id: "reason",
    header: t("columns.reason"),
    render: (row) => (
      <span className={cx("text-sm font-medium", reasonTone(row.priority))}>{row.reason}</span>
    ),
  };

  // The compact table names the provider PROBLEM ("unassigned", "unreachable") because the reason
  // column is not there to carry it; the full feed names the provider and lets the reason speak.
  const provider: Column = {
    id: "provider",
    header: t("columns.provider"),
    render: (row) => {
      if (!isFull && row.providerState) {
        return <span className="text-danger-fg">{t(`attention.${row.providerState}`)}</span>;
      }
      if (row.providerName) return row.providerName;
      return <span className="text-faint">{t("attention.noProvider")}</span>;
    },
  };

  const age: Column = {
    id: "age",
    header: t("columns.age"),
    numeric: true,
    render: (row) => formatAge(row.surfacedAt),
  };

  const actions: Column = {
    id: "actions",
    header: t("columns.actions"),
    render: (row) => (
      <TableActions>
        <AttentionActions
          item={row}
          permissions={permissions}
          isBlocked={isBlocked || acknowledgement.resolvingIds.has(row.alertId)}
          onAcknowledge={() =>
            acknowledgement.acknowledge({ alertId: row.alertId, bookingRef: row.bookingRef })
          }
        />
      </TableActions>
    ),
  };

  return isFull
    ? [priority, booking, service, customer, area, reason, provider, age, actions]
    : [priority, booking, service, area, provider, age, actions];
}
