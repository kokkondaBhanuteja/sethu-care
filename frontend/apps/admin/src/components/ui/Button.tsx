import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cx } from "../../lib/cx";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

/** Visual weight, from the design's button set. A new look is a variant here, never a restyle. */
export const BUTTON_VARIANTS = {
  primary: "btn--primary",
  danger: "btn--danger",
  success: "btn--success",
  outline: "btn--outline",
  outlineBrand: "btn--outline-brand",
  outlineDanger: "btn--outline-danger",
  outlineWarning: "btn--outline-warning",
  outlineSuccess: "btn--outline-success",
  outlineMuted: "btn--outline-muted",
  text: "btn--text",
  textBrand: "btn--text-brand",
  textDanger: "btn--text-danger",
} as const;

/** Heights are semantic, not decorative: 36 inline in a card, 48 for a sticky primary footer. */
export const BUTTON_SIZES = {
  inline: "btn--36",
  section: "btn--40",
  secondary: "btn--44",
  primary: "btn--48",
} as const;

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
  const isInactive = disabled === true || isLoading;

  return (
    <button
      {...rest}
      type={type}
      disabled={isInactive}
      aria-busy={isLoading || undefined}
      className={cx(
        "btn",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        block && "btn--block",
        className,
      )}
    >
      {isLoading ? (
        <Spinner onBrand={variant === "primary" || variant === "danger" || variant === "success"} />
      ) : iconStart ? (
        <Icon glyph={iconStart} />
      ) : null}
      {children}
      {iconEnd && !isLoading ? <Icon glyph={iconEnd} /> : null}
    </button>
  );
}
