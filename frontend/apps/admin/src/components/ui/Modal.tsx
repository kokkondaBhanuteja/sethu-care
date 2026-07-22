import type { ReactNode } from "react";
import { useTranslation } from "@sethu/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from "@sethu/ui-web";

/** Widths from the design: ~440 for a confirm, ~900 for the candidate table (max-w scale). */
export const MODAL_WIDTHS = {
  confirm: "max-w-md",
  compact: "max-w-lg",
  medium: "max-w-xl",
  large: "max-w-2xl",
  default: "max-w-lg",
  wide: "max-w-4xl",
} as const;

export type ModalWidth = keyof typeof MODAL_WIDTHS;

export interface ModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  width?: ModalWidth;
  /** Rendered in the footer, right-aligned. Put the primary action last. */
  footer?: ReactNode;
  /** A left step rail for multi-step destructive flows (manual completion, suspend). */
  rail?: ReactNode;
  onDismiss: () => void;
  /**
   * Blocks scrim-click, Escape and the close button — used once a destructive flow has started a
   * request, so a stray click cannot abandon a half-committed action.
   */
  isDismissable?: boolean;
  children: ReactNode;
}

/**
 * Rebuilt on @sethu/ui-web Dialog (P3 migration): Radix supplies the focus trap, aria wiring and
 * dismissal; the admin isOpen/onDismiss/isDismissable API is unchanged. Blocking, centred (spec
 * §3.3) — anything non-blocking is a Drawer or a Sheet instead.
 */
export function Modal({
  isOpen,
  title,
  subtitle,
  width = "default",
  footer,
  rail,
  onDismiss,
  isDismissable = true,
  children,
}: ModalProps) {
  const { t } = useTranslation("adminShell");
  const blockDismiss = isDismissable ? undefined : (event: Event) => event.preventDefault();

  return (
    <Dialog open={isOpen} onOpenChange={(nextOpen) => (nextOpen ? undefined : onDismiss())}>
      <DialogContent
        // Radix conveys modality by aria-hiding the rest of the page; the attribute keeps the
        // dialog announcing as blocking to tech that reads the element alone.
        aria-modal="true"
        closeLabel={t("actions.close")}
        hideCloseButton={!isDismissable}
        onEscapeKeyDown={blockDismiss}
        onPointerDownOutside={blockDismiss}
        onInteractOutside={blockDismiss}
        // Radix wires the description id when a subtitle renders; explicitly suppressed otherwise
        // (spread, so the auto-wired id is only overridden in the no-subtitle case).
        {...(subtitle ? {} : { "aria-describedby": undefined })}
        // "modal-scrim" is the stable structural hook for the overlay (tests, debugging).
        overlayClassName="modal-scrim"
        className={cn(MODAL_WIDTHS[width], rail && "flex gap-6")}
      >
        {rail}
        <div className="min-w-0 flex-1">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
          </DialogHeader>
          <div className="mt-4">{children}</div>
          {footer ? <DialogFooter>{footer}</DialogFooter> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
