import type { LucideIcon } from "lucide-react";

import { cx } from "../../lib/cx";

/**
 * Icon sizes from the design tokens (spec §4.9). The design uses Lucide at stroke 1.5 throughout,
 * which is exactly what lucide-react renders — so icons come from the package rather than 87
 * hand-copied path strings that would silently drift from the artifacts.
 */
export const ICON_SIZES = {
  sm: "icon--14",
  /** Default: inside list rows. */
  md: "",
  nav: "icon--18",
  lg: "icon--20",
  xl: "icon--24",
  empty: "icon--32",
  hero: "icon--48",
} as const;

export type IconSize = keyof typeof ICON_SIZES;

export interface IconProps {
  /** A lucide-react icon component, e.g. `AlertTriangle`. */
  glyph: LucideIcon;
  size?: IconSize;
  className?: string;
  /** Provide when the icon is the only carrier of meaning; omit when adjacent text says the same. */
  label?: string;
}

/**
 * The single way an icon is rendered. Sizing, stroke and colour all come from the `.icon` class,
 * so no caller passes a pixel size and no icon ever renders at an off-scale dimension.
 */
export function Icon({ glyph: Glyph, size = "md", className, label }: IconProps) {
  return (
    <Glyph
      className={cx("icon", ICON_SIZES[size], className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      // The class owns geometry; these stop lucide's own defaults from winning the cascade.
      size={undefined}
      absoluteStrokeWidth
    />
  );
}
