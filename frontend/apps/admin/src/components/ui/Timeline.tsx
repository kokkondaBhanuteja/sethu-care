import type { ReactNode } from "react";

import { cx } from "../../lib/cx";

export const TIMELINE_TONES = {
  neutral: "",
  success: "timeline__dot--success",
  warning: "timeline__dot--warning",
  danger: "timeline__dot--danger",
  info: "timeline__dot--info",
} as const;

export type TimelineTone = keyof typeof TIMELINE_TONES;

export interface TimelineEntry {
  readonly id: string;
  /** Pre-formatted IST time from lib/format — the timeline never formats its own. */
  readonly time: string;
  readonly tone?: TimelineTone;
  /** `strong` for the state change itself, `muted` for supporting detail. */
  readonly emphasis?: "default" | "strong" | "muted" | "danger";
  readonly body: ReactNode;
}

export interface TimelineProps {
  label: string;
  entries: readonly TimelineEntry[];
  className?: string;
}

/**
 * The booking history rail. Since auto-dispatch became the primary assigner, this is where the
 * "why did this fail" diagnostic lives — each widening round is an entry, so an operator can see
 * that automation tried four times before escalating rather than guessing.
 */
export function Timeline({ label, entries, className }: TimelineProps) {
  return (
    <ol className={cx("timeline", className)} aria-label={label}>
      {entries.map((entry) => (
        <li key={entry.id} className="timeline__item">
          <span className="timeline__time mono">{entry.time}</span>
          <span className={cx("timeline__dot", TIMELINE_TONES[entry.tone ?? "neutral"])} />
          <div
            className={cx(
              "timeline__body",
              entry.emphasis === "strong" && "timeline__body--strong",
              entry.emphasis === "muted" && "timeline__body--muted",
              entry.emphasis === "danger" && "timeline__body--danger",
            )}
          >
            {entry.body}
          </div>
        </li>
      ))}
    </ol>
  );
}
