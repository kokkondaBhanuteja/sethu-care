import { useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { cx } from "../../lib/cx";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { Icon } from "./Icon";

/** Widths from the design: 440 for a confirm, 900 for the candidate table. */
export const MODAL_WIDTHS = {
  confirm: "modal--440",
  compact: "modal--480",
  medium: "modal--560",
  large: "modal--640",
  default: "",
  wide: "modal--900",
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
   * Blocks scrim-click and the close button — used once a destructive flow has started a request,
   * so a stray click cannot abandon a half-committed action.
   */
  isDismissable?: boolean;
  children: ReactNode;
}

/**
 * Blocking, centred, focus-trapped (spec §3.3). Used for confirmations, step-up auth and the
 * multi-step destructive flows. Anything non-blocking is a Drawer or a Sheet instead.
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subtitleId = useId();
  const { t } = useTranslation("adminShell");

  useFocusTrap(dialogRef, isOpen && isDismissable, onDismiss);

  if (!isOpen) return null;

  return (
    <div
      className="modal-scrim"
      onClick={isDismissable ? onDismiss : undefined}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        className={cx("modal", MODAL_WIDTHS[width], Boolean(rail) && "modal--rail")}
        onClick={(event) => event.stopPropagation()}
      >
        {rail}
        <div className={cx(Boolean(rail) && "modal__pane")}>
          <div className="modal__head">
            <div className="grow">
              <div className="modal__title" id={titleId}>
                {title}
              </div>
              {subtitle ? (
                <div className="modal__sub" id={subtitleId}>
                  {subtitle}
                </div>
              ) : null}
            </div>
            {isDismissable ? (
              <button
                type="button"
                className="appbar__btn"
                onClick={onDismiss}
                aria-label={t("actions.close")}
              >
                <Icon glyph={X} size="lg" />
              </button>
            ) : null}
          </div>

          <div className="modal__body">{children}</div>

          {footer ? <div className="modal__foot modal__foot--end">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
