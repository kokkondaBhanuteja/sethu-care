import { cx } from "../../../lib/cx";

export interface ProgressMeterProps {
  present: number;
  required: number;
  /** Announced to assistive tech — the bar is never the only statement of the ratio. */
  label: string;
  className?: string;
}

/**
 * Document completeness. Rendered as a real `progressbar` so "4 of 5" is available without the
 * colour, which is the whole reason the queue also prints the fraction next to it.
 */
export function ProgressMeter({ present, required, label, className }: ProgressMeterProps) {
  const isComplete = present >= required;
  const percent = required > 0 ? Math.round((present / required) * 100) : 0;

  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuenow={present}
      aria-valuemin={0}
      aria-valuemax={required}
      className={cx("block h-s1 w-full overflow-hidden rounded-full bg-inset", className)}
    >
      <span
        className={cx("block h-full rounded-full", isComplete ? "bg-success" : "bg-warning")}
        style={{ width: `${percent}%` }}
      />
    </span>
  );
}
