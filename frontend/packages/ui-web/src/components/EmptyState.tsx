import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

// The "empty" leg of the four-data-states pattern: centred, airy, never a bare wall of nothing.
// Slots over baked-in markup so any screen can mould it — a soft <IconChip> (or illustration),
// a title that carries the meaning, body copy via children, and an optional call to action.
// Omit the native string `title` attribute — the slot deliberately accepts any ReactNode.
export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Visual anchor — typically a soft <IconChip size="lg">. Decorative; the title carries meaning. */
  icon?: ReactNode;
  title: ReactNode;
  /** Primary action(s) — e.g. a <Button> that clears filters or starts the first record. */
  action?: ReactNode;
  titleClassName?: string;
  bodyClassName?: string;
}

export function EmptyState({
  icon,
  title,
  action,
  className,
  titleClassName,
  bodyClassName,
  children,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {icon ? <div className="mb-2">{icon}</div> : null}
      <h3 className={cn("text-base font-semibold text-ink", titleClassName)}>{title}</h3>
      {children ? (
        <div className={cn("max-w-sm text-sm text-muted", bodyClassName)}>{children}</div>
      ) : null}
      {action ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}
