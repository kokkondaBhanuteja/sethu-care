// Day grouping for the mobile ledger (BOX 75): "Today · 20 Jul 2026", then "Yesterday", then the
// date. Grouping is done on the IST calendar day, because that is the day an Indian ops team means.

import type { AuditEntry } from "./audit.types";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

export interface AuditDayGroup {
  /** IST calendar day as `YYYY-MM-DD`; also the React key. */
  readonly day: string;
  readonly isToday: boolean;
  readonly isYesterday: boolean;
  readonly entries: readonly AuditEntry[];
}

function istDay(iso: string): string {
  return new Date(Date.parse(iso) + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function groupEntriesByDay(
  entries: readonly AuditEntry[],
  now: Date = new Date(),
): readonly AuditDayGroup[] {
  const today = istDay(now.toISOString());
  const yesterday = istDay(new Date(now.getTime() - DAY_MS).toISOString());
  const byDay = new Map<string, AuditEntry[]>();

  for (const entry of entries) {
    const day = istDay(entry.timestamp);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(entry);
    else byDay.set(day, [entry]);
  }

  return [...byDay.entries()].map(([day, dayEntries]) => ({
    day,
    isToday: day === today,
    isYesterday: day === yesterday,
    entries: dayEntries,
  }));
}
