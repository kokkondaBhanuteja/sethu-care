import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

// The page-structure rhythm, standardized (the "spacing between components" contract):
//   PageShell — the canvas: px-4 sm:px-6 py-6, cards stacked with gap-6 (24px between sections).
//   PageHeader — title row: h1 + optional description left, actions right; sits above the cards.
// Every screen composes these two, so section spacing is a property of the system, not of each
// screen's judgement. In-card spacing is Card's own (p-4 sm:p-5).
export type PageShellProps = HTMLAttributes<HTMLDivElement>;

export function PageShell({ className, ...props }: PageShellProps) {
  return (
    <div
      className={cn("mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6", className)}
      {...props}
    />
  );
}

export interface PageHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** The h1. Exactly one per screen. */
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned page-level actions (Figma #7: secondary text actions + one primary). */
  actions?: ReactNode;
  titleClassName?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  titleClassName,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)} {...props}>
      <div className="min-w-0">
        <h1 className={cn("text-xl font-semibold text-ink", titleClassName)}>{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
