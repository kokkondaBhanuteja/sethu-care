import type { ReactNode } from "react";

import { cx } from "../lib/cx";

/**
 * Layout primitives — the handful of structural classes the design uses on every screen.
 *
 * These are components rather than Tailwind utilities because their responsive behaviour pivots at
 * 1100px, which is a reflow point rather than a design token. Reproducing them inline would mean a
 * hardcoded arbitrary breakpoint on every page, which is a worse violation than this one is.
 */

export const SPLIT_RATIOS = {
  /** The default 60/40 record view. */
  even: "",
  "65-35": "split--65-35",
  "55-45": "split--55-45",
  "40-60": "split--40-60",
} as const;

export type SplitRatio = keyof typeof SPLIT_RATIOS;

export interface SplitProps {
  ratio?: SplitRatio;
  children: ReactNode;
  className?: string;
}

/** Two columns on a wide screen, stacked below 1100px where the narrow column becomes unusable. */
export function Split({ ratio = "even", children, className }: SplitProps) {
  return <div className={cx("split", SPLIT_RATIOS[ratio], className)}>{children}</div>;
}

export interface StackProps {
  children: ReactNode;
  /** The design uses 20px between sections and 12px inside a group. */
  gap?: "section" | "tight";
  className?: string;
}

/** A vertical run of sections at the design's standard rhythm. */
export function Stack({ children, gap = "section", className }: StackProps) {
  return <div className={cx("stack", gap === "tight" && "stack--12", className)}>{children}</div>;
}

export interface GutterProps {
  children: ReactNode;
  className?: string;
}

/** A padded content column at the standard 16px mobile gutter. */
export function Gutter({ children, className }: GutterProps) {
  return <div className={cx("gut", className)}>{children}</div>;
}

export interface TileGridProps {
  children: ReactNode;
  /** `row` is desktop's single row of KPI tiles; `grid` is mobile's 2×2. */
  variant?: "row" | "grid";
  className?: string;
}

/** The KPI tile container. Falls to two columns below 1100px so tiles stay legible on a laptop. */
export function TileGrid({ children, variant = "row", className }: TileGridProps) {
  return (
    <div className={cx(variant === "row" ? "kpi-row" : "kpi-grid", className)}>{children}</div>
  );
}

export interface SectionGapProps {
  className?: string;
}

/** The 8px recessed band the mobile detail screens use to separate sections. */
export function SectionGap({ className }: SectionGapProps) {
  return <div className={cx("section-gap", className)} />;
}
