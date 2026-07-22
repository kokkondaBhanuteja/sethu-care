import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cx } from "../../lib/cx";
import { Icon } from "./Icon";

/** Status tones. Colour never carries meaning alone — a pill always shows its label too (spec §4.8). */
export const PILL_TONES = {
  danger: "pill--danger",
  warning: "pill--warning",
  success: "pill--success",
  info: "pill--info",
  neutral: "pill--neutral",
  brand: "pill--brand",
  outline: "pill--outline",
} as const;

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
    <span
      className={cx(
        "pill",
        PILL_TONES[tone],
        onTint && "pill--on-tint",
        striped && "pill--striped",
        className,
      )}
    >
      {icon ? <Icon glyph={icon} /> : null}
      {children}
    </span>
  );
}
