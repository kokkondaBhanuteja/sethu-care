import { cx } from "../../lib/cx";

export interface SkeletonProps {
  /** `text` is a 12px line; `pill` a 20px chip; `block` takes the height you give it. */
  shape?: "text" | "pill" | "block";
  /** Tailwind sizing utilities, e.g. "w-full h-row-56". Token-backed, never arbitrary px. */
  className?: string;
}

/**
 * A skeleton must match the shape of what is arriving — the design forbids spinners for content
 * load precisely so the layout does not jump when data lands (spec §4.10).
 */
export function Skeleton({ shape = "block", className }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cx(
        "skeleton",
        shape === "text" && "skeleton--text",
        shape === "pill" && "skeleton--pill",
        "block",
        className,
      )}
    />
  );
}

export interface SkeletonListProps {
  /** How many placeholder rows to draw — match the page size the real list will show. */
  rows?: number;
  /** Row height utility, e.g. "h-row-56" for a standard list row. */
  rowClassName?: string;
  label: string;
}

export function SkeletonList({ rows = 6, rowClassName = "h-row-56", label }: SkeletonListProps) {
  return (
    <div className="skeleton-list" role="status" aria-busy aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className={cx("w-full", rowClassName)} />
      ))}
    </div>
  );
}
