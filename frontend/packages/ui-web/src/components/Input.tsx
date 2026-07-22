import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

// The one text field. The visible box is a wrapper — not the <input> itself — so the leading/
// trailing slots (search icon, currency unit, clear button) live inside the same border, and the
// focus ring wraps the whole control via focus-within. `fill` mirrors the refs: white fields on
// gray panels (surface), gray inset fields on white cards (inset).
const inputVariants = cva(
  "flex w-full items-center gap-2 rounded-md border transition-colors " +
    "focus-within:ring-2 focus-within:ring-ring has-disabled:cursor-not-allowed " +
    "has-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      fill: {
        surface: "border-border bg-surface",
        inset: "border-transparent bg-inset",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-10 px-3 text-sm",
        lg: "h-11 px-4 text-base",
      },
      invalid: {
        true: "border-danger-border focus-within:ring-danger-border",
        false: "",
      },
    },
    defaultVariants: { fill: "surface", size: "md", invalid: false },
  },
);

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">, VariantProps<typeof inputVariants> {
  /** Slot before the text — a lucide icon, a currency prefix… Decorative nodes stay aria-hidden. */
  leading?: ReactNode;
  /** Slot after the text — a unit, a clear button… */
  trailing?: ReactNode;
  /** Classes for the inner <input>; `className` styles the visible box. */
  inputClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

export function Input({
  className,
  inputClassName,
  fill,
  size,
  invalid,
  leading,
  trailing,
  ref,
  ...props
}: InputProps) {
  return (
    <div className={cn(inputVariants({ fill, size, invalid }), className)}>
      {leading}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-full w-full min-w-0 flex-1 bg-transparent text-ink outline-none " +
            "placeholder:text-faint disabled:cursor-not-allowed",
          inputClassName,
        )}
        {...props}
      />
      {trailing}
    </div>
  );
}

export { inputVariants };
