import type { ComponentProps } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "../lib/cn";

// Radix select dressed to sit beside Input: the trigger shares the field silhouette (same fill/
// size/invalid axes) and the dropdown floats on the overlay shadow like every popover surface.
const selectTriggerVariants = cva(
  "flex w-full items-center justify-between gap-2 rounded-md border text-left transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
    "disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-faint " +
    "[&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      fill: {
        surface: "border-border bg-surface text-ink",
        inset: "border-transparent bg-inset text-ink",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-10 px-3 text-sm",
        lg: "h-11 px-4 text-base",
      },
      invalid: {
        true: "border-danger-border focus-visible:ring-danger-border",
        false: "",
      },
    },
    defaultVariants: { fill: "surface", size: "md", invalid: false },
  },
);

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export interface SelectTriggerProps
  extends
    ComponentProps<typeof SelectPrimitive.Trigger>,
    VariantProps<typeof selectTriggerVariants> {}

export function SelectTrigger({
  className,
  fill,
  size,
  invalid,
  children,
  ...props
}: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      aria-invalid={invalid || undefined}
      className={cn(selectTriggerVariants({ fill, size, invalid }), className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown aria-hidden className="text-faint" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = "popper",
  sideOffset = 4,
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        sideOffset={sideOffset}
        // Radix runtime var — no design token can know the trigger's rendered width.
        className={cn(
          "z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border " +
            "border-border bg-surface text-ink shadow-overlay",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-2 pl-3 pr-8 " +
          "text-sm text-ink outline-none focus:bg-inset " +
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="absolute right-2 inline-flex items-center" aria-hidden>
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4 text-primary" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

export function SelectLabel({ className, ...props }: ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn("px-3 py-1.5 text-xs font-medium text-faint", className)}
      {...props}
    />
  );
}

export function SelectSeparator({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    // Hairline in px by design — sub-rem rules render inconsistently across zoom levels.
    <SelectPrimitive.Separator className={cn("my-1 h-px bg-border", className)} {...props} />
  );
}

export { selectTriggerVariants };
