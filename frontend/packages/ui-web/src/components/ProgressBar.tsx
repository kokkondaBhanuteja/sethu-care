import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

// The reference's in-table stock bars: a rounded track with a vivid fill and an optional value
// label. Tone is explicit or derived (pass toneFor to map value -> tone, e.g. stock thresholds).
// Always labelled for assistive tech; the visual % label is opt-in.
const progressFillVariants = cva("h-full rounded-full transition-[width]", {
  variants: {
    tone: {
      danger: "bg-accent-red",
      warning: "bg-accent-amber",
      success: "bg-accent-green",
      brand: "bg-primary",
      neutral: "bg-neutral-fg",
    },
  },
  defaultVariants: { tone: "brand" },
});

type ProgressTone = NonNullable<VariantProps<typeof progressFillVariants>["tone"]>;

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** 0–100. Clamped. */
  value: number;
  /** Accessible name, e.g. "Stock level" (apps localize). */
  label: string;
  tone?: ProgressTone;
  /** Derive the tone from the value (wins over `tone`). */
  toneFor?: (value: number) => ProgressTone;
  /** Render the numeric label beside the bar. */
  showValue?: boolean;
  /** Format the visible value (default: "50%"). */
  formatValue?: (value: number) => string;
  trackClassName?: string;
  fillClassName?: string;
}

export function ProgressBar({
  value,
  label,
  tone,
  toneFor,
  showValue,
  formatValue,
  trackClassName,
  fillClassName,
  className,
  ...props
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const resolvedTone = toneFor ? toneFor(clamped) : tone;

  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn("h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-inset", trackClassName)}
      >
        <div
          className={cn(progressFillVariants({ tone: resolvedTone }), fillClassName)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showValue ? (
        <span className="shrink-0 text-sm tabular-nums text-ink">
          {formatValue ? formatValue(clamped) : `${Math.round(clamped)}%`}
        </span>
      ) : null}
    </div>
  );
}

export { progressFillVariants };
