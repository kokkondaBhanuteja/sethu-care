import { useEffect, useRef, type ReactNode } from "react";
import { Sheet as UiSheet, SheetContent, SheetFooter, SheetTitle, cn } from "@sethu/ui-web";

export interface SheetProps {
  isOpen: boolean;
  title: string;
  /** Hide the title visually when the sheet's own content already states it. */
  hideTitle?: boolean;
  footer?: ReactNode;
  onDismiss: () => void;
  children: ReactNode;
}

/**
 * The mobile bottom sheet, rebuilt on @sethu/ui-web Sheet side="bottom" (P3 migration): filters,
 * pickers, quick actions and confirmations (spec §3.3). The content behind stays visible but
 * dimmed, because the spec repeatedly asks for the list to remain readable as context.
 */
export function Sheet({
  isOpen,
  title,
  hideTitle = false,
  footer,
  onDismiss,
  children,
}: SheetProps) {
  // Controlled Radix root without a Trigger: hand focus back to the opener on close (WCAG 2.4.3).
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (isOpen && document.activeElement instanceof HTMLElement) {
      openerRef.current = document.activeElement;
    }
  }, [isOpen]);

  return (
    <UiSheet open={isOpen} onOpenChange={(nextOpen) => (nextOpen ? undefined : onDismiss())}>
      <SheetContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          openerRef.current?.focus();
        }}
        side="bottom"
        aria-modal="true"
        hideCloseButton
        aria-describedby={undefined}
        // "scrim" is the stable structural hook for the overlay (tests, debugging).
        overlayClassName="scrim"
      >
        {/* The grabber — decorative; dismissal is the scrim, Escape or the footer actions. */}
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-border-strong" />
        <SheetTitle className={cn(hideTitle && "sr-only")}>{title}</SheetTitle>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <SheetFooter>{footer}</SheetFooter> : null}
      </SheetContent>
    </UiSheet>
  );
}
