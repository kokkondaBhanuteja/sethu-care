import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "../../lib/cx";

/** Fill tone. A tinted card is a whole-card signal; use `edge` for a lighter severity mark. */
export const CARD_TONES = {
  plain: "",
  danger: "card--danger",
  warning: "card--warning",
  success: "card--success",
  info: "card--info",
  surface: "card--surface",
  tintDanger: "card--tint-danger",
  tintWarning: "card--tint-warning",
  tintSuccess: "card--tint-success",
  tintInfo: "card--tint-info",
} as const;

/** The 3px left edge that marks severity without repainting the whole card. */
export const CARD_EDGES = {
  none: "",
  danger: "card--edge-danger",
  warning: "card--edge-warning",
  success: "card--edge-success",
  brand: "card--edge-brand",
} as const;

/** A 1px outline in a status colour — a lighter mark than the 3px edge, for a whole-card state. */
export const CARD_OUTLINES = {
  none: "",
  danger: "card--outline-danger",
  warning: "card--outline-warning",
  success: "card--outline-success",
} as const;

export type CardTone = keyof typeof CARD_TONES;
export type CardEdge = keyof typeof CARD_EDGES;
export type CardOutline = keyof typeof CARD_OUTLINES;

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
  tone?: CardTone;
  edge?: CardEdge;
  outline?: CardOutline;
  /** `flush` removes padding for rows and tables; `tight` drops it to 12px. */
  density?: "default" | "flush" | "tight";
  selected?: boolean | "danger";
  children: ReactNode;
  className?: string;
}

export function Card({
  tone = "plain",
  edge = "none",
  outline = "none",
  density = "default",
  selected = false,
  children,
  className,
  ...rest
}: CardProps) {
  return (
    <div
      {...rest}
      className={cx(
        "card",
        CARD_TONES[tone],
        CARD_EDGES[edge],
        CARD_OUTLINES[outline],
        density === "flush" && "card--flush",
        density === "tight" && "card--tight",
        selected === true && "is-selected",
        selected === "danger" && "is-selected-danger",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface CardListProps {
  children: ReactNode;
  /** The design uses 12px between dense rows and 20px between full cards. */
  gap?: "tight" | "roomy";
  className?: string;
}

export function CardList({ children, gap = "tight", className }: CardListProps) {
  return (
    <div className={cx("card-list", gap === "roomy" && "card-list--20", className)}>{children}</div>
  );
}
