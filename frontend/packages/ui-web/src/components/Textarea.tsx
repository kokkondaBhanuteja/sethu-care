import type { Ref, TextareaHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

// Multiline sibling of Input — same fill/invalid contract so a form mixes single- and multi-line
// fields without a visible seam. Height is left to the consumer (rows / min-h) because the refs
// size notes fields per screen.
const textareaVariants = cva(
  "flex min-h-20 w-full rounded-md border px-3 py-2 text-sm text-ink transition-colors " +
    "placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      fill: {
        surface: "border-border bg-surface",
        inset: "border-transparent bg-inset",
      },
      invalid: {
        true: "border-danger-border focus-visible:ring-danger-border",
        false: "",
      },
    },
    defaultVariants: { fill: "surface", invalid: false },
  },
);

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>, VariantProps<typeof textareaVariants> {
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({ className, fill, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(textareaVariants({ fill, invalid }), className)}
      {...props}
    />
  );
}

export { textareaVariants };
