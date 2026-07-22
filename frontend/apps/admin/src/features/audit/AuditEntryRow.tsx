import { useTranslation } from "@sethu/i18n";

import { Avatar } from "../../components/ui/Avatar";
import { formatTime } from "../../lib/format";
import { AuditActionPill } from "./AuditActionPill";
import { AuditMono } from "./AuditDefList";
import { REASON_LABEL_KEYS } from "./audit.constants";
import { changeSummary } from "./auditChange";
import type { AuditEntry } from "./audit.types";

export interface AuditEntryRowProps {
  entry: AuditEntry;
  onSelect: (entryId: string) => void;
}

/**
 * A ledger line, not a card: bottom rule, no shadow, no radius, no swipe action. Four flat lines
 * per entry — who, what, from → to, why — read down the column far faster than floating cards
 * (BOX 75). The row opens the entry; it never acts on it.
 */
export function AuditEntryRow({ entry, onSelect }: AuditEntryRowProps) {
  const { t } = useTranslation("adminAudit");
  const reasonKey = entry.reason ? REASON_LABEL_KEYS[entry.reason.code] : undefined;
  const reasonLabel = entry.reason ? (reasonKey ? t(reasonKey) : entry.reason.code) : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.id)}
      className="w-full text-left flex items-start gap-s3 px-s4 py-s3 border-b border-border-subtle"
    >
      <Avatar name={entry.admin.name} size="xs" />
      <span className="flex flex-col gap-s1 grow min-w-0">
        <span className="flex items-start justify-between gap-s2">
          <span className="flex items-center gap-s2 min-w-0">
            <span className="text-label font-semibold text-text-1 truncate">
              {entry.admin.name}
            </span>
            <AuditActionPill action={entry.action} withIcon />
          </span>
          <span className="font-mono tabular-nums text-caption text-text-3 flex-none">
            {formatTime(entry.timestamp)}
          </span>
        </span>

        <AuditMono brand>{entry.target.reference}</AuditMono>

        <span className="text-caption text-text-2 break-words">
          {changeSummary(entry.before, entry.after)}
        </span>

        {/* Long notes stay in the detail view; the row carries the short reason label only. */}
        <span className="text-caption text-text-3 line-clamp-2">
          {reasonLabel ? t("row.reason", { value: reasonLabel }) : t("row.noReason")}
          {` · ${entry.context.deviceName}`}
        </span>
      </span>
    </button>
  );
}
