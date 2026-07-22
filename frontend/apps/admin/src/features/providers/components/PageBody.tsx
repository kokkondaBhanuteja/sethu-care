import type { ReactNode } from "react";

import { cx } from "../../../lib/cx";

export interface PageBodyProps {
  children: ReactNode;
  className?: string;
}

/**
 * The desktop scrolling content region under the page's own Topbar. Sticky table headers resolve
 * against THIS element rather than the viewport, so it owns the overflow.
 *
 * Lives in the feature because `layouts/` exposes no equivalent today — see the feature CLAUDE.md;
 * it should be promoted once a second feature needs it.
 */
export function DesktopMain({ children, className }: PageBodyProps) {
  return (
    <main className={cx("min-h-0 grow overflow-y-auto bg-canvas p-s6", className)}>{children}</main>
  );
}

/** The mobile scroll region between a sticky app bar and a sticky action bar. */
export function MobileScroll({ children, className }: PageBodyProps) {
  return (
    <div className={cx("min-h-0 grow overflow-y-auto overscroll-contain", className)}>
      {children}
    </div>
  );
}

/** The 8px recessed divider the mobile record screens use between sections. */
export function SectionGap() {
  return <div aria-hidden className="h-s2 border-y border-border-subtle bg-surface" />;
}
