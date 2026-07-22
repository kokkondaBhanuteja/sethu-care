// Client-side CSV of the currently filtered ledger. This is a READ — a copy of what the screen
// already shows, built in the browser with no server round trip — so the append-only guarantee is
// untouched: nothing here (or anywhere in this feature) can write to the log.

import { formatDate, formatTime } from "../../lib/format";
import { changeSummary } from "./auditChange";
import type { AuditEntry } from "./audit.types";

/** Column headers arrive translated from the screen, so this file stays free of react-i18next. */
export interface AuditCsvHeaders {
  readonly entryId: string;
  readonly timestamp: string;
  readonly admin: string;
  readonly action: string;
  readonly target: string;
  readonly change: string;
  readonly reason: string;
}

/** Excel assumes a legacy codepage without the BOM, which mangles the ₹ and → glyphs. Written as
    an escape so no editor re-save can eat the invisible character. */
const UTF8_BOM = "\uFEFF";
const CSV_MIME_TYPE = "text/csv;charset=utf-8";
const ROW_SEPARATOR = "\r\n";

/** Every field is quoted, so commas, quotes and newlines in a reason note survive round-trip. */
function escapeCsvField(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/**
 * One ledger line. The action and reason are the canonical §10.4 codes rather than display labels,
 * because an exported compliance record must survive a copy-change; the timestamp is the same
 * en-IN IST rendering the screen shows (`lib/format`).
 */
function entryToCsvRow(entry: AuditEntry): readonly string[] {
  return [
    entry.id,
    `${formatDate(entry.timestamp)} ${formatTime(entry.timestamp)} IST`,
    entry.admin.name,
    entry.action,
    entry.target.reference,
    changeSummary(entry.before, entry.after),
    entry.reason?.code ?? "",
  ];
}

export function buildAuditCsv(entries: readonly AuditEntry[], headers: AuditCsvHeaders): string {
  const headerRow: readonly string[] = [
    headers.entryId,
    headers.timestamp,
    headers.admin,
    headers.action,
    headers.target,
    headers.change,
    headers.reason,
  ];
  const rows = [headerRow, ...entries.map(entryToCsvRow)];
  return UTF8_BOM + rows.map((row) => row.map(escapeCsvField).join(",")).join(ROW_SEPARATOR);
}

/** `audit-log-2026-07-23.csv` — the ISO date sorts a folder of exports chronologically. */
export function auditCsvFilename(now: Date = new Date()): string {
  const isoDate = now.toISOString().split("T")[0] ?? "";
  return `audit-log-${isoDate}.csv`;
}

/** A Blob behind a transient anchor: nothing persists beyond the file the browser saves. */
export function downloadAuditCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: CSV_MIME_TYPE });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
