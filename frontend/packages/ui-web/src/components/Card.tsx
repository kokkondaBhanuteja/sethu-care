import type { HTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

// The card silhouette every screen is built from: white, rounded-card (16px), soft shadow, on the
// gray canvas. `tone` produces the reference's tinted feature cards (the "Get Started" trio);
// CardHeader standardises the icon + title + per-card-actions anatomy so every card reads the same.
const cardVariants = cva("rounded-card border shadow-card", {
  variants: {
    tone: {
      plain: "border-border bg-surface",
      amber: "border-tint-amber-border bg-tint-amber-bg",
      green: "border-tint-green-border bg-tint-green-bg",
      purple: "border-tint-purple-border bg-tint-purple-bg",
      blue: "border-tint-blue-border bg-tint-blue-bg",
      danger: "border-danger-border bg-danger-bg",
    },
  },
  defaultVariants: { tone: "plain" },
});

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

export function Card({ className, tone, ...props }: CardProps) {
  return <div className={cn(cardVariants({ tone }), className)} {...props} />;
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** Leading visual — typically an <IconChip>. */
  icon?: ReactNode;
  /** Right-aligned per-card controls (refresh, "View report", "Download CSV"…). */
  actions?: ReactNode;
}

export function CardHeader({ icon, actions, className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 p-4 sm:p-5", className)} {...props}>
      {icon}
      <div className="min-w-0 flex-1 text-base font-semibold text-ink">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4 sm:px-5 sm:pb-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5",
        className,
      )}
      {...props}
    />
  );
}

export { cardVariants };
