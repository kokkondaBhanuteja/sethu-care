import type { HTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

// The coloured rounded-square icon holder that anchors KPI tiles, card headers and the feature
// cards in the reference designs. Two looks: `solid` (vivid accent fill, white glyph — Figma #8's
// KPI chips) and `soft` (pale tint, saturated glyph — Figma #6's Get Started cards). Decorative by
// default: pairs with a visible label, so it is aria-hidden unless a label is passed.
const iconChipVariants = cva("inline-flex shrink-0 items-center justify-center [&_svg]:shrink-0", {
  variants: {
    accent: {
      green: "",
      red: "",
      blue: "",
      purple: "",
      amber: "",
      teal: "",
      brand: "",
    },
    look: {
      solid: "text-on-primary",
      soft: "",
    },
    size: {
      sm: "size-8 rounded-md [&_svg]:size-4",
      md: "size-10 rounded-lg [&_svg]:size-5",
      lg: "size-12 rounded-lg [&_svg]:size-6",
    },
  },
  compoundVariants: [
    { accent: "green", look: "solid", className: "bg-accent-green" },
    { accent: "red", look: "solid", className: "bg-accent-red" },
    { accent: "blue", look: "solid", className: "bg-accent-blue" },
    { accent: "purple", look: "solid", className: "bg-accent-purple" },
    { accent: "amber", look: "solid", className: "bg-accent-amber" },
    { accent: "teal", look: "solid", className: "bg-accent-teal" },
    { accent: "brand", look: "solid", className: "bg-primary" },
    { accent: "green", look: "soft", className: "bg-tint-green-bg text-tint-green-fg" },
    { accent: "red", look: "soft", className: "bg-danger-bg text-danger-fg" },
    { accent: "blue", look: "soft", className: "bg-tint-blue-bg text-tint-blue-fg" },
    { accent: "purple", look: "soft", className: "bg-tint-purple-bg text-tint-purple-fg" },
    { accent: "amber", look: "soft", className: "bg-tint-amber-bg text-tint-amber-fg" },
    { accent: "teal", look: "soft", className: "bg-tint-green-bg text-accent-teal" },
    { accent: "brand", look: "soft", className: "bg-info-bg text-primary" },
  ],
  defaultVariants: { accent: "brand", look: "soft", size: "md" },
});

export interface IconChipProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof iconChipVariants> {
  /** Accessible name. Omit when a visible label sits beside the chip (it becomes decorative). */
  label?: string;
  children: ReactNode;
}

export function IconChip({
  accent,
  look,
  size,
  label,
  className,
  children,
  ...props
}: IconChipProps) {
  return (
    <span
      className={cn(iconChipVariants({ accent, look, size }), className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...props}
    >
      {children}
    </span>
  );
}

export { iconChipVariants };
