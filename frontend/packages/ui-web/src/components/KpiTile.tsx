import type { HTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";
import { IconChip, type IconChipProps } from "./IconChip";

// The reference KPI unit (Figma #8): coloured chip, muted caption, big text-kpi number, optional
// trend line. `vertical` is the dashboard strip; `horizontal` suits dense side panels. With
// `onClick` the tile becomes a real <button> (drill-down) and gains the focus ring + hover lift.
const kpiTileVariants = cva(
  "flex rounded-card border border-border bg-surface p-4 text-left shadow-card sm:p-5",
  {
    variants: {
      layout: {
        vertical: "flex-col items-start gap-3",
        horizontal: "flex-row items-center gap-4",
      },
    },
    defaultVariants: { layout: "vertical" },
  },
);

const INTERACTIVE_TILE_CLASSES =
  "w-full cursor-pointer transition-shadow hover:shadow-lifted focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export interface KpiTileProps
  extends Omit<HTMLAttributes<HTMLElement>, "children">, VariantProps<typeof kpiTileVariants> {
  /** Muted caption above/beside the number. */
  label: ReactNode;
  /** The KPI figure itself — already formatted by the app (currency, counts…). */
  value: ReactNode;
  /** Optional trend line under the number — e.g. a <StatusPill> or an arrow + percent node. */
  delta?: ReactNode;
  /** Lucide glyph rendered inside the built-in <IconChip>. */
  icon?: ReactNode;
  /** Accent of the built-in chip. */
  accent?: IconChipProps["accent"];
  /** Look of the built-in chip — `solid` matches the Figma #8 KPI strip. */
  chipLook?: IconChipProps["look"];
  /** Full replacement for the built-in chip when accent/look can't be moulded far enough. */
  chip?: ReactNode;
  labelClassName?: string;
  valueClassName?: string;
}

export function KpiTile({
  layout,
  label,
  value,
  delta,
  icon,
  accent,
  chipLook = "solid",
  chip,
  onClick,
  className,
  labelClassName,
  valueClassName,
  ...props
}: KpiTileProps) {
  const chipNode =
    chip ??
    (icon ? (
      <IconChip accent={accent} look={chipLook}>
        {icon}
      </IconChip>
    ) : null);
  const tileContent = (
    <>
      {chipNode}
      <div className="min-w-0">
        <div className={cn("text-sm font-medium text-muted", labelClassName)}>{label}</div>
        <div className={cn("mt-1 text-kpi font-semibold text-ink", valueClassName)}>{value}</div>
        {delta ? (
          <div className="mt-1 flex items-center gap-1 text-sm text-muted">{delta}</div>
        ) : null}
      </div>
    </>
  );
  const tileClassName = cn(
    kpiTileVariants({ layout }),
    onClick ? INTERACTIVE_TILE_CLASSES : null,
    className,
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={tileClassName} {...props}>
        {tileContent}
      </button>
    );
  }
  return (
    <div className={tileClassName} {...props}>
      {tileContent}
    </div>
  );
}

export { kpiTileVariants };
