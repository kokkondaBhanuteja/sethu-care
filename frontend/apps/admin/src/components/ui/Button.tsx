import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Button as UiButton, cn, type ButtonProps as UiButtonProps } from "@sethu/ui-web";

import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

/**
 * Thin adapter over @sethu/ui-web Button (P3 migration): the admin-side API is unchanged, each
 * admin variant maps onto a ui-web variant plus token-utility overrides for the looks the global
 * set does not carry (the outline-{tone} and text-{tone} families).
 */
interface VariantMapping {
  readonly variant: NonNullable<UiButtonProps["variant"]>;
  readonly extra?: string;
}

interface SizeMapping {
  readonly size: NonNullable<UiButtonProps["size"]>;
  readonly extra?: string;
}

export const BUTTON_VARIANTS = {
  primary: { variant: "primary" },
  danger: { variant: "destructive" },
  success: { variant: "success" },
  outline: { variant: "outline" },
  outlineBrand: { variant: "outline", extra: "border-info-border text-primary hover:bg-info-bg" },
  outlineDanger: {
    variant: "outline",
    extra: "border-danger-border text-danger-fg hover:bg-danger-bg",
  },
  outlineWarning: {
    variant: "outline",
    extra: "border-warning-border text-warning-fg hover:bg-warning-bg",
  },
  outlineSuccess: {
    variant: "outline",
    extra: "border-success-border text-success-fg hover:bg-success-bg",
  },
  outlineMuted: { variant: "outline", extra: "text-muted" },
  text: { variant: "ghost" },
  textBrand: { variant: "ghost", extra: "text-link hover:bg-info-bg" },
  textDanger: { variant: "ghost", extra: "text-danger-fg hover:bg-danger-bg" },
} as const satisfies Record<string, VariantMapping>;

/** Heights stay semantic: 36 inline in a card, 48 for a sticky primary footer (h-12 = 48px). */
export const BUTTON_SIZES = {
  // 32px suits a dense desktop table row, but sits below the app's 44px tap floor on touch —
  // below the 768px shell split (max-md) the minimum is lifted; desktop density is untouched.
  inline: { size: "sm", extra: "max-md:min-h-11" },
  section: { size: "md" },
  secondary: { size: "lg", extra: "h-11" },
  primary: { size: "lg", extra: "h-12" },
} as const satisfies Record<string, SizeMapping>;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;
export type ButtonSize = keyof typeof BUTTON_SIZES;

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Shows a spinner, disables the button and announces busy — the duplicate-submission guard. */
  isLoading?: boolean;
  iconStart?: LucideIcon;
  iconEnd?: LucideIcon;
  children?: ReactNode;
  className?: string;
}

export function Button({
  variant = "outline",
  size = "section",
  block = false,
  isLoading = false,
  iconStart,
  iconEnd,
  disabled,
  children,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const mappedVariant: VariantMapping = BUTTON_VARIANTS[variant];
  const mappedSize: SizeMapping = BUTTON_SIZES[size];

  return (
    <UiButton
      {...rest}
      type={type}
      variant={mappedVariant.variant}
      size={mappedSize.size}
      disabled={disabled === true || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(mappedVariant.extra, mappedSize.extra, block && "w-full", className)}
    >
      {isLoading ? (
        <Spinner onBrand={variant === "primary" || variant === "danger" || variant === "success"} />
      ) : iconStart ? (
        <Icon glyph={iconStart} />
      ) : null}
      {children}
      {iconEnd && !isLoading ? <Icon glyph={iconEnd} /> : null}
    </UiButton>
  );
}
