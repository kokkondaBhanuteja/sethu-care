import type { ReactNode } from "react";

import { cx } from "../lib/cx";

export interface ActionBarProps {
  children: ReactNode;
  /** A caveat under the buttons — "The customer is notified", "This cannot be undone". */
  note?: ReactNode;
  /** Puts the note above the actions, where the consequence must be read before the tap. */
  noteAbove?: boolean;
  /** Right-align rather than fill — desktop modal footers. */
  end?: boolean;
  className?: string;
}

/**
 * The sticky footer that carries a screen's primary action. Pinned outside the scroll region so the
 * commitment is always visible: an operator must never have to scroll to find out that the button
 * they are reaching for cancels a booking.
 *
 * `note` exists because several flows have a consequence that has to sit next to the button rather
 * than three sections up — `noteAbove` puts it in the reading path before the tap.
 */
export function ActionBar({
  children,
  note,
  noteAbove = false,
  end = false,
  className,
}: ActionBarProps) {
  return (
    <div className={cx("actionbar", end && "actionbar--end", className)}>
      {note && noteAbove ? <p className="actionbar__note actionbar__note--above">{note}</p> : null}
      {children}
      {note && !noteAbove ? <p className="actionbar__note">{note}</p> : null}
    </div>
  );
}
