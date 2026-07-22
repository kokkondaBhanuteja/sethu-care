import { useId, useRef, type ReactNode } from "react";

import { cx } from "../../lib/cx";
import { useFocusTrap } from "../../hooks/useFocusTrap";

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
 * The mobile bottom sheet: filters, pickers, quick actions and confirmations (spec §3.3). Dismissed
 * by the grabber, the scrim or Escape. The content behind stays visible but dimmed, because the
 * spec repeatedly asks for the list to remain readable as context.
 */
export function Sheet({
  isOpen,
  title,
  hideTitle = false,
  footer,
  onDismiss,
  children,
}: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap(sheetRef, isOpen, onDismiss);

  if (!isOpen) return null;

  return (
    <div className="overlay overlay--bottom">
      <div className="scrim" onClick={onDismiss} role="presentation" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="sheet"
      >
        <div className="sheet__grabber" />
        <h2 className={cx("t-section w-semi c-1 gut", hideTitle && "sr-only")} id={titleId}>
          {title}
        </h2>
        <div className="sheet__body">{children}</div>
        {footer ? <div className="sheet__foot">{footer}</div> : null}
      </div>
    </div>
  );
}
