// en-IN formatting for the whole console (Admin spec §4.7). Screens call these; no screen builds a
// `toLocaleString` call of its own, because a distributed ops team reading two different clocks or
// two different lakh groupings is a source of real error.
//
// Money arrives from the backend as paise (int64) and is formatted through @sethu/domain, which
// mirrors the backend's Money value object. Nothing here does float arithmetic on money.

import { formatPaise, paiseToRupees } from "@sethu/domain";

/** Timestamps are stored UTC and rendered IST. Deliberately not user-configurable (spec §4.7). */
const IST = "Asia/Kolkata";
const LOCALE = "en-IN";

const LAKH = 100_000;
const CRORE = 10_000_000;

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: IST,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: IST,
  day: "2-digit",
  month: "short",
});

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: IST,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** `₹2,14,500.00` — the full, unambiguous amount. Use where the exact figure matters. */
export const formatMoney = formatPaise;

const wholeRupeeFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * `₹1,499` — the design's list and card treatment, where two trailing zeros are noise in a column
 * an operator is scanning. Use `formatMoney` wherever the exact paise matter: a refund amount, a
 * settlement line, anything an operator might have to reconcile.
 */
export function formatMoneyWhole(paise: number): string {
  return wholeRupeeFormatter.format(paiseToRupees(paise));
}

/** `₹2.1L` / `₹1.4Cr` — KPI tiles and dense table cells, where the magnitude is the message. */
export function formatMoneyCompact(paise: number): string {
  const rupees = paiseToRupees(paise);
  const absolute = Math.abs(rupees);
  if (absolute >= CRORE) return `₹${trimZero(rupees / CRORE)}Cr`;
  if (absolute >= LAKH) return `₹${trimZero(rupees / LAKH)}L`;
  if (absolute >= 1_000) return `₹${trimZero(rupees / 1_000)}K`;
  return `₹${Math.round(rupees)}`;
}

function trimZero(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

/** `20/07/2026` */
export function formatDate(iso: string | Date): string {
  if (isUnrenderable(iso)) return INVALID_DATE_PLACEHOLDER;
  return dateFormatter.format(toDate(iso));
}

/** `20 Jul` */
export function formatDateShort(iso: string | Date): string {
  if (isUnrenderable(iso)) return INVALID_DATE_PLACEHOLDER;
  return shortDateFormatter.format(toDate(iso));
}

/** `3:42 PM` */
export function formatTime(iso: string | Date): string {
  if (isUnrenderable(iso)) return INVALID_DATE_PLACEHOLDER;
  return timeFormatter.format(toDate(iso));
}

/** `20 Jul, 3:42 PM` — the timeline and audit-log stamp. */
export function formatDateTime(iso: string | Date): string {
  if (isUnrenderable(iso)) return INVALID_DATE_PLACEHOLDER;
  const value = toDate(iso);
  return `${shortDateFormatter.format(value)}, ${timeFormatter.format(value)}`;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * `2m ago` / `4h ago` under 24 hours, then an absolute date — because "3 days ago" is a worse
 * answer than "17 Jul" when an operator is reconstructing what happened.
 */
export function formatRelative(iso: string | Date, now: Date = new Date()): string {
  if (isUnrenderable(iso)) return INVALID_DATE_PLACEHOLDER;
  const elapsed = now.getTime() - toDate(iso).getTime();
  if (elapsed < MINUTE_MS) return "just now";
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}m ago`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h ago`;
  return formatDateShort(iso);
}

/** `12m` / `3m 12s` / `2h 04m` — the age column, where every row must occupy one line. */
export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  return `${seconds}s`;
}

/**
 * Age of a record, in the single-unit form the queue tables use: `12m`, `2h 04m`, `45s`.
 *
 * Coarser than `formatDuration` on purpose. An age is scanned down a column to find the worst
 * problem, and "34m 15s" makes that column a paragraph — the seconds are noise, and they change
 * under the operator's eyes while they read. Durations that are themselves the measurement (average
 * assignment time) keep their seconds; ages do not.
 */
export function formatAge(iso: string | Date, now: Date = new Date()): string {
  if (isUnrenderable(iso)) return INVALID_DATE_PLACEHOLDER;
  const elapsed = Math.max(0, now.getTime() - toDate(iso).getTime());
  if (elapsed < MINUTE_MS) return `${Math.floor(elapsed / 1000)}s`;
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}m`;

  const hours = Math.floor(elapsed / HOUR_MS);
  const minutes = Math.floor((elapsed % HOUR_MS) / MINUTE_MS);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

/** `+91 98765 43210` from an E.164 number; anything unexpected is returned untouched. */
export function formatPhone(e164: string): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return match ? `+91 ${match[1]} ${match[2]}` : e164;
}

/** `94.2%` — one decimal at most, because a second one is noise at a glance. */
export function formatPercent(fraction: number): string {
  return `${trimZero(fraction * 100)}%`;
}

/** Rendered in place of a timestamp that is absent or unparseable. */
const INVALID_DATE_PLACEHOLDER = "—";

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * True when a value cannot be rendered as a date.
 *
 * These formatters are called from ~40 screens, and `Intl.DateTimeFormat.format` THROWS on an
 * invalid date rather than returning something useless. A single absent timestamp therefore used to
 * take down an entire route — it killed the whole manual-completion flow. A missing date is a data
 * problem worth showing as a dash; it is not worth losing the screen over.
 */
function isUnrenderable(value: string | Date): boolean {
  return Number.isNaN(toDate(value).getTime());
}
