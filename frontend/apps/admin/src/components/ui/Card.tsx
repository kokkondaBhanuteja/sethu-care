import type { HTMLAttributes, ReactNode } from "react";
import { Card as UiCard, cn, type CardProps as UiCardProps } from "@sethu/ui-web";

/**
 * Thin adapter over @sethu/ui-web Card (P3 migration). The admin tone/edge/outline/density/
 * selected API is unchanged; tones map onto the global tinted-card palette, and the 3px severity
 * edge / 1px status outline are composed as token border utilities on top.
 */
type UiTone = NonNullable<UiCardProps["tone"]>;

export const CARD_TONES = {
  plain: "plain",
  danger: "danger",
  warning: "amber",
  success: "green",
  info: "blue",
  surface: "plain",
  tintDanger: "danger",
  tintWarning: "amber",
  tintSuccess: "green",
  tintInfo: "blue",
} as const satisfies Record<string, UiTone>;

/** The left edge that marks severity without repainting the whole card. */
export const CARD_EDGES = {
  none: "",
  danger: "border-l-4 border-l-danger-fg",
  warning: "border-l-4 border-l-warning-fg",
  success: "border-l-4 border-l-success-fg",
  brand: "border-l-4 border-l-primary",
} as const;

/** A 1px outline in a status colour — a lighter mark than the edge, for a whole-card state. */
export const CARD_OUTLINES = {
  none: "",
  danger: "border-danger-fg",
  warning: "border-warning-fg",
  success: "border-success-fg",
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
    <UiCard
      {...rest}
      tone={CARD_TONES[tone]}
      className={cn(
        density === "default" && "p-4",
        density === "tight" && "p-3",
        // Legacy `surface` tone was the recessed grouping fill, now the canvas gray.
        tone === "surface" && "bg-canvas shadow-none",
        CARD_EDGES[edge],
        CARD_OUTLINES[outline],
        selected === true && "border-info-border bg-info-bg",
        selected === "danger" && "border-danger-border bg-danger-bg",
        className,
      )}
    >
      {children}
    </UiCard>
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
    <div className={cn("flex flex-col", gap === "roomy" ? "gap-5" : "gap-3", className)}>
      {children}
    </div>
  );
}
