import type { ComponentProps, HTMLAttributes } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "../lib/cn";

// Modal built on Radix (focus trap, esc/outside dismiss, aria wiring for free). Anatomy per the
// refs: dim ink overlay, centred rounded-card surface with the overlay shadow, Header/Title/
// Description/Footer, X close. Apps localize `closeLabel` — ui-web never imports i18n.
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  overlayClassName?: string;
  /** Accessible name for the X button (localized by the app). */
  closeLabel?: string;
  /** Hide the X for confirm-only dialogs where the footer buttons are the exits. */
  hideCloseButton?: boolean;
}

export function DialogContent({
  className,
  overlayClassName,
  closeLabel = "Close",
  hideCloseButton = false,
  children,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={cn("fixed inset-0 z-50 bg-ink/40", overlayClassName)} />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 " +
            "rounded-card bg-surface p-6 shadow-overlay focus:outline-none",
          className,
        )}
        {...props}
      >
        {children}
        {hideCloseButton ? null : (
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className={cn(
              "absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-md " +
                "text-muted transition-colors hover:bg-inset hover:text-ink " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // pr-8 keeps long titles clear of the absolutely-positioned X button.
  return <div className={cn("flex flex-col gap-1.5 pr-8", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title className={cn("text-lg font-semibold text-ink", className)} {...props} />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm text-muted", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // Stacked full-width buttons on mobile, right-aligned row from sm: up.
  return (
    <div
      className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}
