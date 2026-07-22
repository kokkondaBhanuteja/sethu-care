import type { ReactNode } from "react";

import { cx } from "../lib/cx";

export interface SettingsLayoutProps {
  children: ReactNode;
  /** A narrow explanatory card floating beside the column — consequences, runbooks, contacts. */
  aside?: ReactNode;
  /** The wider 960px column, for the payouts and reports surfaces. */
  wide?: boolean;
  className?: string;
}

/**
 * The settings family's frame: a fixed-width reading column, optionally with an explanatory aside.
 *
 * Settings screens are read, not scanned. A full-bleed column at 1440px would put 140 characters on
 * a line, so the design pins it to 720px (960 where a table needs the room) and lets the canvas take
 * the rest. Below the shell breakpoint the ceiling in components.css collapses it to full width.
 */
export function SettingsLayout({ children, aside, wide = false, className }: SettingsLayoutProps) {
  const column = (
    <div className={cx("settings-col", wide && "settings-col--960", className)}>{children}</div>
  );

  if (!aside) return column;

  return (
    <div className="settings-layout">
      {column}
      <div className="settings-aside">{aside}</div>
    </div>
  );
}
