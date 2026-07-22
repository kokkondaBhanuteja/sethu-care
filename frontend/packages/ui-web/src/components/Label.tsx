import type { ComponentProps } from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

// The field caption from the reference forms: small, medium weight, muted, always ABOVE its
// control. Radix Label wires click-to-focus; the peer-disabled styles let a caption placed after
// a `peer`-marked control dim in sync when that control is disabled.
const labelVariants = cva(
  "text-sm font-medium text-muted peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
);

export interface LabelProps
  extends ComponentProps<typeof LabelPrimitive.Root>, VariantProps<typeof labelVariants> {}

export function Label({ className, ...props }: LabelProps) {
  return <LabelPrimitive.Root className={cn(labelVariants(), className)} {...props} />;
}

export { labelVariants };
