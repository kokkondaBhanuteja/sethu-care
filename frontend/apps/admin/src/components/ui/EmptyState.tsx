import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { EmptyState as UiEmptyState, IconChip, cn } from "@sethu/ui-web";

import tableEmptyArtwork from "../../assets/table-empty.png";

export interface EmptyStateProps {
  icon: LucideIcon;
  /** Replace the icon chip with the brand empty illustration — the default face of every empty
      table (product decision: the clipboard artwork). */
  illustration?: boolean;
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
 * Thin adapter over @sethu/ui-web EmptyState (P3 migration): the admin state semantics (positive,
 * grow, the required explain-why body) are preserved, with the icon presented in a soft IconChip
 * per the global empty-state anatomy. Callers must still distinguish genuinely empty from
 * filtered-empty (spec §4.10) — see FilteredEmptyState.
 */
export function EmptyState({
  icon: IconGlyph,
  illustration = false,
  title,
  body,
  actions,
  positive = false,
  grow = false,
  className,
}: EmptyStateProps) {
  return (
    <UiEmptyState
      icon={
        illustration ? (
          <img src={tableEmptyArtwork} alt="" aria-hidden className="h-20 w-20" />
        ) : (
          <IconChip look="soft" accent={positive ? "green" : "brand"} size="lg">
            <IconGlyph aria-hidden />
          </IconChip>
        )
      }
      title={title}
      titleClassName={cn(positive && "text-success-fg")}
      action={actions}
      className={cn(grow && "flex-1", className)}
    >
      {body}
    </UiEmptyState>
  );
}
