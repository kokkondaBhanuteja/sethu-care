import type { ComponentProps } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

// Row/kebab menus on Radix (keyboard nav, typeahead, aria wiring). Overlay look per the refs:
// white rounded-lg panel with the overlay shadow. `destructive` tone marks irreversible items
// (delete, suspend) in the danger pair so intent is visible before the click.
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export type DropdownMenuContentProps = ComponentProps<typeof DropdownMenuPrimitive.Content>;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-40 overflow-hidden rounded-lg border border-border bg-surface p-1 " +
            "shadow-overlay",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

const dropdownMenuItemVariants = cva(
  "flex cursor-pointer select-none items-center gap-2 rounded-sm px-3 py-2 text-sm " +
    "outline-none transition-colors data-[disabled]:pointer-events-none " +
    "data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        default: "text-ink focus:bg-inset",
        destructive: "text-danger-fg focus:bg-danger-bg",
      },
    },
    defaultVariants: { tone: "default" },
  },
);

export interface DropdownMenuItemProps
  extends
    ComponentProps<typeof DropdownMenuPrimitive.Item>,
    VariantProps<typeof dropdownMenuItemVariants> {}

export function DropdownMenuItem({ className, tone, ...props }: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(dropdownMenuItemVariants({ tone }), className)}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn("px-3 py-1.5 text-xs font-medium text-faint", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export { dropdownMenuItemVariants };
