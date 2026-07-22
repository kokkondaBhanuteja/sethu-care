import type { HTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

// The reference's status language: a tinted pill with a saturated label ("Paid Via Card",
// "Due in 3 days", "Expired"). Status is never colour alone (WCAG): callers pass a label always,
// and an optional 16px icon when the design shows one. Countdown semantics map onto the tones —
// paid/healthy=success, due-soon=warning, overdue/critical=danger.
const statusPillVariants = cva(
  "inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap " +
    "[&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        success: "bg-success-bg text-success-fg",
        warning: "bg-warning-bg text-warning-fg",
        danger: "bg-danger-bg text-danger-fg",
        info: "bg-info-bg text-info-fg",
        neutral: "bg-neutral-bg text-neutral-fg",
        brand: "bg-info-bg text-primary",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px]",
        md: "px-2.5 py-1 text-xs",
      },
      outlined: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      { tone: "success", outlined: true, className: "border border-success-border" },
      { tone: "warning", outlined: true, className: "border border-warning-border" },
      { tone: "danger", outlined: true, className: "border border-danger-border" },
      { tone: "info", outlined: true, className: "border border-info-border" },
      { tone: "neutral", outlined: true, className: "border border-neutral-border" },
      { tone: "brand", outlined: true, className: "border border-info-border" },
    ],
    defaultVariants: { tone: "neutral", size: "md", outlined: false },
  },
);

export interface StatusPillProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof statusPillVariants> {
  /** Optional leading 16px lucide icon. */
  icon?: ReactNode;
}

export function StatusPill({
  tone,
  size,
  outlined,
  icon,
  className,
  children,
  ...props
}: StatusPillProps) {
  return (
    <span className={cn(statusPillVariants({ tone, size, outlined }), className)} {...props}>
      {icon}
      {children}
    </span>
  );
}

export { statusPillVariants };
