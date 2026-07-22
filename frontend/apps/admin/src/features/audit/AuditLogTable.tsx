import { useMemo } from "react";
import { useTranslation } from "@sethu/i18n";

import { Avatar } from "../../components/ui/Avatar";
import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { formatDateShort, formatTime } from "../../lib/format";
import { AuditActionPill } from "./AuditActionPill";
import { AuditMono } from "./AuditDefList";
import { AuditTargetLink } from "./AuditTargetLink";
import { REASON_LABEL_KEYS } from "./audit.constants";
import { changeSummary } from "./auditChange";
import type { AuditEntry } from "./audit.types";

export interface AuditLogTableProps {
  entries: readonly AuditEntry[];
  /** The `?entry=` selection — the tinted row must match the record the detail panel shows. */
  selectedEntryId: string | null;
  onSelect: (entryId: string) => void;
}

/**
 * The ledger. Six columns an ops manager reads down rather than across: who, what, which record,
 * what changed, why. No row carries an action — there is nothing to do to an entry (BOX 48). The
 * target reference is the row's one outward link; clicking it navigates instead of selecting.
 */
export function AuditLogTable({ entries, selectedEntryId, onSelect }: AuditLogTableProps) {
  const { t } = useTranslation("adminAudit");

  const columns = useMemo<readonly DataTableColumn<AuditEntry>[]>(
    () => [
      {
        id: "time",
        header: t("columns.time"),
        render: (entry) => (
          <span className="flex flex-col">
            <AuditMono>{formatTime(entry.timestamp)}</AuditMono>
            <span className="text-caption text-text-3">{formatDateShort(entry.timestamp)}</span>
          </span>
        ),
      },
      {
        id: "admin",
        header: t("columns.admin"),
        render: (entry) => (
          <span className="flex items-center gap-s2">
            <Avatar name={entry.admin.name} size="xs" />
            <span className="text-caption text-text-1">{entry.admin.name}</span>
          </span>
        ),
      },
      {
        id: "action",
        header: t("columns.action"),
        render: (entry) => (
          <AuditActionPill action={entry.action} withIcon={entry.compensatesEntryId !== null} />
        ),
      },
      {
        id: "target",
        header: t("columns.target"),
        render: (entry) => <AuditTargetLink target={entry.target} />,
      },
      {
        id: "change",
        header: t("columns.change"),
        // The → is the point of the column; it must wrap rather than widen the table.
        render: (entry) => (
          <span className="text-caption text-text-1 break-words">
            {changeSummary(entry.before, entry.after)}
          </span>
        ),
      },
      {
        id: "reason",
        header: t("columns.reason"),
        render: (entry) => <ReasonCell entry={entry} />,
      },
    ],
    [t],
  );

  return (
    <DataTable
      caption={t("table.caption")}
      columns={columns}
      rows={entries}
      rowKey={(entry) => entry.id}
      density="dense"
      selectedRowKey={selectedEntryId}
      onRowClick={(entry) => onSelect(entry.id)}
    />
  );
}

/** The short reason label only. The full note lives in the detail view, where it can wrap freely. */
function ReasonCell({ entry }: { entry: AuditEntry }) {
  const { t } = useTranslation("adminAudit");
  if (!entry.reason) return <span className="text-caption text-text-3">—</span>;

  const key = REASON_LABEL_KEYS[entry.reason.code];
  return (
    <span className="text-caption text-text-2 break-words">{key ? t(key) : entry.reason.code}</span>
  );
}
