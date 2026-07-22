import type { ReactNode } from "react";
import { useTranslation } from "@sethu/i18n";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, cn } from "@sethu/ui-web";

export interface DrawerProps {
  isOpen: boolean;
  title: string;
  /** `narrow` for filters and settings-shaped work; default for a record side panel. */
  width?: "narrow" | "default";
  footer?: ReactNode;
  onDismiss: () => void;
  children: ReactNode;
}

/**
 * Rebuilt on @sethu/ui-web Sheet, side="right" (P3 migration) — a panel for settings-shaped work
 * that must not hide the record it acts on. Desktop only; the mobile equivalent is the bottom
 * Sheet. The admin isOpen/onDismiss API is unchanged.
 */
export function Drawer({
  isOpen,
  title,
  width = "default",
  footer,
  onDismiss,
  children,
}: DrawerProps) {
  const { t } = useTranslation("adminShell");

  return (
    <Sheet open={isOpen} onOpenChange={(nextOpen) => (nextOpen ? undefined : onDismiss())}>
      <SheetContent
        side="right"
        aria-modal="true"
        closeLabel={t("actions.close")}
        aria-describedby={undefined}
        // "modal-scrim" is the stable structural hook for the overlay (tests, debugging).
        overlayClassName="modal-scrim"
        className={cn(width === "narrow" && "max-w-sm")}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 min-h-0 flex-1">{children}</div>
        {footer ? <SheetFooter>{footer}</SheetFooter> : null}
      </SheetContent>
    </Sheet>
  );
}
