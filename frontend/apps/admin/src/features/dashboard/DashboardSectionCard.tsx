import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, IconChip, type IconChipProps } from "@sethu/ui-web";

export interface DashboardSectionCardProps {
  /** Lucide glyph for the header chip. */
  icon: LucideIcon;
  /** Soft chip accent — amber for the queue, brand for the ticker (colour discipline). */
  accent: NonNullable<IconChipProps["accent"]>;
  title: string;
  /** Right-aligned per-card controls — the "View all" outline button, the refresh icon-button. */
  actions?: ReactNode;
  /** Tables run edge-to-edge under the header; lists keep the card's content padding. */
  flush?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * The dashboard's grouping surface: a plain white Card with the reference icon-header anatomy —
 * soft-tinted IconChip, one h2, per-card actions. Both shells compose their sections from this,
 * so the two dashboards stay one design rather than two (spec §2.1). The chip is the only colour
 * the header carries; everything else is ink on white.
 */
export function DashboardSectionCard({
  icon: HeaderGlyph,
  accent,
  title,
  actions,
  flush = false,
  children,
  className,
}: DashboardSectionCardProps) {
  return (
    <Card className={className}>
      <CardHeader
        icon={
          <IconChip accent={accent} look="soft">
            <HeaderGlyph />
          </IconChip>
        }
        actions={actions}
      >
        {/* Sections are h2 under the page's single h1; CardHeader's own div styles the text. */}
        <h2>{title}</h2>
      </CardHeader>
      {flush ? children : <CardContent>{children}</CardContent>}
    </Card>
  );
}
