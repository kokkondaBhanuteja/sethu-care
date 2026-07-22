import { useTranslation } from "@sethu/i18n";

import { formatDateShort } from "../../lib/format";
import { AuditEntryRow } from "./AuditEntryRow";
import { groupEntriesByDay } from "./auditGrouping";
import type { AuditEntry } from "./audit.types";

export interface AuditDayListProps {
  entries: readonly AuditEntry[];
  onSelect: (entryId: string) => void;
}

/** The mobile ledger, grouped by IST calendar day (BOX 75). */
export function AuditDayList({ entries, onSelect }: AuditDayListProps) {
  const { t } = useTranslation("adminAudit");
  const groups = groupEntriesByDay(entries);

  return (
    <div>
      {groups.map((group) => (
        <section key={group.day}>
          <h2 className="px-s4 pt-s5 pb-s2 text-pill uppercase text-text-3">
            {group.isToday ? `${t("day.today")} · ` : null}
            {group.isYesterday ? `${t("day.yesterday")} · ` : null}
            {formatDateShort(`${group.day}T00:00:00+05:30`)}
          </h2>
          {group.entries.map((entry) => (
            <AuditEntryRow key={entry.id} entry={entry} onSelect={onSelect} />
          ))}
        </section>
      ))}
    </div>
  );
}
