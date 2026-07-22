import { cx } from "../../lib/cx";

export interface BadgeProps {
  count: number;
  /** What the count refers to — required, because a bare number announces as nothing useful. */
  label: string;
  /** `brand` for informational counts; the default red is reserved for "a human must act". */
  tone?: "danger" | "brand";
  /** Counts above this render as "N+", keeping the badge one glyph wide. */
  max?: number;
  className?: string;
}

/**
 * A count badge. Badge discipline (spec §3.1): the Alerts badge counts ONLY unacknowledged critical
 * alerts. A badge that counts everything sits permanently non-zero, and a permanently non-zero
 * badge is invisible — it must mean "a human must act".
 */
export function Badge({ count, label, tone = "danger", max = 9, className }: BadgeProps) {
  if (count <= 0) return null;

  return (
    <span className={cx("badge", tone === "brand" && "badge--brand", className)}>
      <span aria-hidden>{count > max ? `${max}+` : count}</span>
      <span className="sr-only">
        {count} {label}
      </span>
    </span>
  );
}
