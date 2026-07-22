import { cn } from "@sethu/ui-web";

export interface SpinnerProps {
  /** Kept for API compatibility: the ring draws in currentColor, so it adapts on brand fills. */
  onBrand?: boolean;
  className?: string;
  /** Announced to screen readers while the action is in flight. */
  label?: string;
}

/**
 * Marks an action in flight. Content loading uses Skeleton instead — the design is explicit that a
 * spinner never stands in for a screen's data (spec §4.10). currentColor keeps it legible on both
 * white and brand surfaces without a variant.
 */
export function Spinner({ onBrand = false, className, label }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        onBrand && "text-on-primary",
        className,
      )}
    />
  );
}
