import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, IconChip, cn } from "@sethu/ui-web";

import { Icon } from "../../components/ui/Icon";
import type { DetailSectionChip } from "./bookings.constants";

export interface BookingSectionCardProps {
  title: string;
  /** Icon + fixed accent from DETAIL_SECTION_CHIPS — a section reads the same on every booking. */
  chip: DetailSectionChip;
  /** Trailing header affordances (call/message, "Add note"…). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** IconChip carries no neutral accent; the timeline/notes chips recess into the inset grey. */
const NEUTRAL_CHIP_CLASSES = "bg-inset text-muted";

/**
 * One record section as an icon-headed card (Figma #7): soft chip, section title, per-section
 * actions on the right, content below. The chip is decorative — the title carries the meaning —
 * and the accent colour never appears anywhere else in the card, keeping ink/muted body text.
 */
export function BookingSectionCard({
  title,
  chip,
  actions,
  children,
  className,
}: BookingSectionCardProps) {
  return (
    <Card className={className}>
      <CardHeader
        icon={
          <IconChip
            size="sm"
            look="soft"
            {...(chip.accent === "neutral" ? {} : { accent: chip.accent })}
            className={cn(chip.accent === "neutral" && NEUTRAL_CHIP_CLASSES)}
          >
            <Icon glyph={chip.icon} />
          </IconChip>
        }
        {...(actions ? { actions } : {})}
      >
        <h2>{title}</h2>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
