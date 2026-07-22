import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

// Loading placeholder: pulsing inset block shaped by the caller (h-4 w-40, size-10 rounded-full…).
// aria-hidden — screens announce loading once at the container level, not per shimmering block.
export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div aria-hidden className={cn("animate-pulse rounded-md bg-inset", className)} {...props} />
  );
}

export interface SkeletonTextProps extends HTMLAttributes<HTMLDivElement> {
  /** Number of placeholder lines. */
  lines?: number;
  lineClassName?: string;
}

// Paragraph placeholder — the last line runs short so the block reads as text, not as a table.
export function SkeletonText({ lines = 3, lineClassName, className, ...props }: SkeletonTextProps) {
  return (
    <div aria-hidden className={cn("flex flex-col gap-2", className)} {...props}>
      {[...Array(lines).keys()].map((lineIndex) => (
        <Skeleton
          key={lineIndex}
          className={cn(
            "h-4",
            lines > 1 && lineIndex === lines - 1 ? "w-4/5" : "w-full",
            lineClassName,
          )}
        />
      ))}
    </div>
  );
}
