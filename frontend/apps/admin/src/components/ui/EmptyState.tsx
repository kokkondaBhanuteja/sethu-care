import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cx } from "../../lib/cx";
import { Icon } from "./Icon";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  /** One line explaining why there is nothing here — never just "No data". */
  body?: string;
  /** The way forward, when one exists. */
  actions?: ReactNode;
  /**
   * "All clear" reads as relief, not absence: an empty alerts feed is good news and the design
   * colours it green rather than grey.
   */
  positive?: boolean;
  /** Fills the remaining height — use when the empty state owns the whole screen. */
  grow?: boolean;
  className?: string;
}

/**
 * Nothing to show. Callers must distinguish genuinely empty from filtered-empty (spec §4.10) by
 * choosing different copy and offering "Clear filters" in the filtered case — see FilteredEmptyState.
 */
export function EmptyState({
  icon,
  title,
  body,
  actions,
  positive = false,
  grow = false,
  className,
}: EmptyStateProps) {
  return (
    <div className={cx("empty", grow && "empty--grow", positive && "empty--positive", className)}>
      <Icon glyph={icon} size="empty" className="empty__icon" />
      {/*
        A heading, not a paragraph. Every §4.10 state renders through here — empty, filtered-empty,
        error + retry, not-found, permission-denied, coming-soon and the fatal boundary — and each
        one is the only thing on its region. A screen reader user landing on "Something went wrong"
        needs it in the heading list to find it; as a <p> the whole state was unaddressable.
        Styling is class-driven, so the tag change is purely semantic.
      */}
      <h2 className="empty__title">{title}</h2>
      {body ? <p className="empty__body">{body}</p> : null}
      {actions ? <div className="empty__actions">{actions}</div> : null}
    </div>
  );
}
