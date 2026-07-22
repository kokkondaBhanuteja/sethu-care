import type { ReactNode } from "react";

import { cx } from "../../../lib/cx";

export interface ActionBarProps {
  children: ReactNode;
  /** Explains a disabled primary action. Sits BEFORE the buttons in reading order on purpose. */
  note?: ReactNode;
  className?: string;
}

/**
 * The mobile sticky footer the destructive flows end in. It is `flex-none` inside `.screen` so the
 * scroll region shrinks around it rather than the bar scrolling away from the decision it commits.
 */
export function ActionBar({ children, note, className }: ActionBarProps) {
  return (
    <div className={cx("flex-none border-t border-border-subtle bg-canvas px-s4 py-s3", className)}>
      {note ? <div className="mb-s2 text-center text-caption text-danger">{note}</div> : null}
      {children}
    </div>
  );
}
