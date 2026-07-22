import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { StatusPill, cn, type StatusPillProps } from "@sethu/ui-web";

import { Icon } from "./Icon";

/**
 * Thin adapter over @sethu/ui-web StatusPill (P3 migration). Admin tone names map directly onto
 * the global tones; `outline` becomes the outlined neutral treatment. Colour never carries meaning
 * alone — a pill always shows its label too (spec §4.8).
 */
export const PILL_TONES = {
  danger: "danger",
  warning: "warning",
  success: "success",
  info: "info",
  neutral: "neutral",
  brand: "brand",
  outline: "neutral",
} as const satisfies Record<string, NonNullable<StatusPillProps["tone"]>>;

export type PillTone = keyof typeof PILL_TONES;

export interface PillProps {
  tone: PillTone;
  children: ReactNode;
  icon?: LucideIcon;
  /** Sitting on a tinted card, where the default background would vanish. */
  onTint?: boolean;
  /** Diagonal stripes — the design's marker for a provisional or degraded value. */
  striped?: boolean;
  className?: string;
}

export function Pill({
  tone,
  children,
  icon,
  onTint = false,
  striped = false,
  className,
}: PillProps) {
  return (
    <StatusPill
      tone={PILL_TONES[tone]}
      size="sm"
      outlined={tone === "outline" || onTint}
      icon={icon ? <Icon glyph={icon} size="sm" /> : undefined}
      className={cn(
        tone === "outline" && "bg-surface",
        onTint && "bg-surface",
        // The hatch overlay stays a component-layer class: a repeating gradient has no utility.
        striped && "pill--striped",
        className,
      )}
    >
      {children}
    </StatusPill>
  );
}
