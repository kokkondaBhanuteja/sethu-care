import type { ComponentProps, HTMLAttributes } from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "../lib/cn";

// Side drawer on the Radix dialog primitive (same focus trap + dismiss semantics as Dialog).
// `bottom` is the mobile filter sheet (rounded top edge); `right`/`left` are desktop detail
// panels. max-h-dvh + overflow keep long filter lists scrollable inside the sheet.
export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

const sheetContentVariants = cva(
  "fixed z-50 flex flex-col overflow-y-auto bg-surface p-6 shadow-overlay focus:outline-none",
  {
    variants: {
      side: {
        right: "inset-y-0 right-0 h-full w-full max-w-md",
        left: "inset-y-0 left-0 h-full w-full max-w-md",
        bottom: "inset-x-0 bottom-0 max-h-dvh w-full rounded-t-card",
      },
    },
    defaultVariants: { side: "right" },
  },
);

export interface SheetContentProps
  extends ComponentProps<typeof SheetPrimitive.Content>, VariantProps<typeof sheetContentVariants> {
  overlayClassName?: string;
  /** Accessible name for the X button (localized by the app). */
  closeLabel?: string;
  hideCloseButton?: boolean;
}

export function SheetContent({
  side,
  className,
  overlayClassName,
  closeLabel = "Close",
  hideCloseButton = false,
  children,
  ...props
}: SheetContentProps) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className={cn("fixed inset-0 z-50 bg-ink/40", overlayClassName)} />
      <SheetPrimitive.Content className={cn(sheetContentVariants({ side }), className)} {...props}>
        {children}
        {hideCloseButton ? null : (
          <SheetPrimitive.Close
            aria-label={closeLabel}
            className={cn(
              "absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-md " +
                "text-muted transition-colors hover:bg-inset hover:text-ink " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <X className="size-4" aria-hidden />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // pr-8 keeps long titles clear of the absolutely-positioned X button.
  return <div className={cn("flex flex-col gap-1.5 pr-8", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title className={cn("text-lg font-semibold text-ink", className)} {...props} />
  );
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn("text-sm text-muted", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // mt-auto pins the footer to the sheet's end when content is short (apply/clear filter row).
  return (
    <div
      className={cn(
        "mt-auto flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

export { sheetContentVariants };
