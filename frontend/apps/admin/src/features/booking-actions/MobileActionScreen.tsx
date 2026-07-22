import type { ReactNode } from "react";

import { MobileAppBar } from "../../layouts/MobileAppBar";

export interface MobileActionScreenProps {
  title: string;
  /** The booking reference, parked on the right of the app bar so the subject is never lost. */
  reference?: string;
  /** Close (an X) rather than back — these are modal tasks with one non-decision way out. */
  onClose: () => void;
  /** Progress bar, context strip, offline banner — anything that must not scroll away. */
  aboveScroll?: ReactNode;
  children: ReactNode;
  /** The sticky commit bar. */
  footer?: ReactNode;
  /**
   * A line above the footer button. It sits ABOVE because it exists to explain why the button is
   * blocked, and a reason read after the button is not a reason.
   */
  footerNote?: ReactNode;
}

/**
 * The mobile frame every booking action shares: a fixed header, an optional pinned strip, one
 * scroll region, and a sticky action bar. Written with token utilities rather than the design's
 * BEM classes, which only `components/ui/*` and `layouts/*` may use.
 */
export function MobileActionScreen({
  title,
  reference,
  onClose,
  aboveScroll,
  children,
  footer,
  footerNote,
}: MobileActionScreenProps) {
  return (
    <>
      <MobileAppBar
        title={title}
        compact
        bordered
        showBack
        // These are modal tasks, not pushed screens: the X says "abandon this", where a chevron
        // says "go up a level". On a form about to cancel a booking the difference matters.
        backIcon="close"
        onBack={onClose}
        actions={
          reference ? <span className="text-label text-text-2">{reference}</span> : undefined
        }
      />

      {aboveScroll}

      <div className="flex-1 overflow-y-auto overscroll-contain pb-s5">{children}</div>

      {footer ? (
        <div className="flex-none border-t border-border-subtle bg-canvas px-s4 py-s3">
          {footerNote ? <div className="mb-s2 text-center">{footerNote}</div> : null}
          {footer}
        </div>
      ) : null}
    </>
  );
}
