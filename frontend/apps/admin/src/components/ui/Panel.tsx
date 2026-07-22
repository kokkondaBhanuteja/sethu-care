import type { ReactNode } from "react";

import { cx } from "../../lib/cx";

export interface PanelProps {
  title?: string;
  /** Trailing header affordance — "See all", a filter control, a segmented switch. */
  headerActions?: ReactNode;
  footer?: ReactNode;
  /** Removes body padding, for a panel whose entire body is a table. */
  flush?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * The desktop grouping container: a titled card that owns its own scroll and clips a table's sticky
 * header. Mobile groups with a SectionHeader over a CardList instead.
 */
export function Panel({
  title,
  headerActions,
  footer,
  flush = true,
  children,
  className,
}: PanelProps) {
  return (
    <section className={cx("panel", className)}>
      {title || headerActions ? (
        <div className="panel__head">
          {title ? <span className="panel__title">{title}</span> : null}
          {headerActions ? <div className="ml-auto row-start">{headerActions}</div> : null}
        </div>
      ) : null}
      {flush ? children : <div className="panel__body">{children}</div>}
      {footer ? <div className="panel__foot">{footer}</div> : null}
    </section>
  );
}

export interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
  className?: string;
}

/** The mobile equivalent of a panel head: a title over a group of cards, at the 16px gutter. */
export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  return (
    <div className={cx("section-header", className)}>
      <h2 className="section-header__title">{title}</h2>
      {action ? <div className="section-header__action">{action}</div> : null}
    </div>
  );
}
