// Quiet hours and the digest are wall-clock IST, not instants: "10:00 PM" means ten at night
// wherever the admin's laptop thinks it is. These helpers convert between that `HH:mm` form and the
// shared formatters — display always goes through lib/format, never through a local Intl call.

import { formatTime } from "../../lib/format";
import type { ClockTime, QuietHours } from "./settings.types";

const IST_OFFSET = "+05:30";
/** Any date works: only the time-of-day is read back out. */
const ANCHOR_DATE = "2026-01-01";
const MINUTES_PER_HOUR = 60;

const istClockParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** `"22:00"` → `"10:00 PM"`, through the shared formatter so the locale rules stay in one place. */
export function formatClockTime(clock: ClockTime): string {
  return formatTime(`${ANCHOR_DATE}T${clock}:00${IST_OFFSET}`);
}

function toMinutes(clock: ClockTime): number {
  const [hours = "0", minutes = "0"] = clock.split(":");
  return Number(hours) * MINUTES_PER_HOUR + Number(minutes);
}

/** Minutes past IST midnight, right now. */
export function istMinutesNow(now: Date = new Date()): number {
  return toMinutes(istClockParts.format(now));
}

/**
 * True while quiet hours are running. The window normally wraps midnight (22:00 → 07:00), so a
 * naive `from <= now < to` comparison would report the exact inverse for most of the night.
 */
export function isQuietHoursActive(quietHours: QuietHours, now: Date = new Date()): boolean {
  if (!quietHours.enabled) return false;

  const current = istMinutesNow(now);
  const from = toMinutes(quietHours.from);
  const to = toMinutes(quietHours.to);

  return from <= to ? current >= from && current < to : current >= from || current < to;
}

const MINUTES_IN_DAY = 24 * MINUTES_PER_HOUR;
const CLOCK_STEP_MINUTES = 30;

/** Half-hour steps across a whole day — the granularity quiet hours and a nightly digest need. */
export const CLOCK_OPTIONS: readonly ClockTime[] = Array.from(
  { length: MINUTES_IN_DAY / CLOCK_STEP_MINUTES },
  (_unused, index) => {
    const minutes = index * CLOCK_STEP_MINUTES;
    const hourPart = String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(2, "0");
    const minutePart = String(minutes % MINUTES_PER_HOUR).padStart(2, "0");
    return `${hourPart}:${minutePart}`;
  },
);
