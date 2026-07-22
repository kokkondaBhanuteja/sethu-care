import type { ReactNode } from "react";

import { cx } from "../lib/cx";

export interface PageMainProps {
  children: ReactNode;
  /** Edge-to-edge, for the map and other screens that own their whole canvas. */
  flush?: boolean;
  /** The recessed grey canvas the settings family sits on. */
  onSurface?: boolean;
  id?: string;
  className?: string;
}

/**
 * The desktop scrolling content region. Sticky table headers and sticky panels resolve against
 * THIS element rather than the viewport, which is what lets one screen hold a sticky topbar, a
 * sticky alert band and a sticky table header at once.
 *
 * Exists because every desktop screen needs it: without a primitive, each page would reach for the
 * `.main` BEM class directly and the components.css boundary would erode one page at a time.
 */
export function PageMain({
  children,
  flush = false,
  onSurface = false,
  id,
  className,
}: PageMainProps) {
  return (
    <main
      id={id}
      className={cx("main", flush && "main--flush", onSurface && "main--surface", className)}
    >
      {children}
    </main>
  );
}

export interface MobileScrollProps {
  children: ReactNode;
  /** Clears a sticky bottom action bar, or the tab bar. */
  padFor?: "tabbar" | "action";
  className?: string;
}

/** The mobile equivalent — the scroll container inside `.screen`, for the same sticky reason. */
export function MobileScroll({ children, padFor, className }: MobileScrollProps) {
  return (
    <div
      className={cx(
        "screen__scroll",
        padFor === "tabbar" && "screen__scroll--pad-tabbar",
        padFor === "action" && "screen__scroll--pad-action",
        className,
      )}
    >
      {children}
    </div>
  );
}
