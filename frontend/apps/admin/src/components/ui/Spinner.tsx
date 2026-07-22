import { cx } from "../../lib/cx";

export interface SpinnerProps {
  /** Use on a brand-coloured surface, where the default border would disappear. */
  onBrand?: boolean;
  className?: string;
  /** Announced to screen readers while the action is in flight. */
  label?: string;
}

/**
 * Marks an action in flight. Content loading uses Skeleton instead — the design is explicit that a
 * spinner never stands in for a screen's data (spec §4.10).
 */
export function Spinner({ onBrand = false, className, label }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cx("spinner", onBrand && "spinner--onbrand", className)}
    />
  );
}
