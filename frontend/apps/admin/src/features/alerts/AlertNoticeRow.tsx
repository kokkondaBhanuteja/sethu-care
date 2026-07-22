import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { Icon } from "../../components/ui/Icon";
import { cx } from "../../lib/cx";
import { formatRelative } from "../../lib/format";
import { ROUTES } from "../../routes/routes.constants";
import { ALERT_TYPE_ICONS, SEVERITY_INK } from "./alerts.constants";
import type { Alert } from "./alerts.types";
import { useAlertTitle } from "./useAlertTitle";

export interface AlertNoticeRowProps {
  alert: Alert;
  /** Desktop draws these flush to the column edge; mobile insets them to the 16px gutter. */
  inset?: boolean;
}

/**
 * Tier two, rendered as far down the emphasis ramp as it goes: no card, no border, no tint, no left
 * edge, no action — a 48px row with a hairline under it. The ignorable tier has to genuinely look
 * ignorable, or the tier above it stops meaning anything (spec §6.20). It is still a link, though,
 * so it carries the app's link affordances: a hover fill and the trailing chevron.
 */
export function AlertNoticeRow({ alert, inset = false }: AlertNoticeRowProps) {
  const titleOf = useAlertTitle();

  return (
    <Link
      to={ROUTES.alertDetail(alert.id)}
      className={cx(
        "flex min-h-row-48 items-center gap-s3 border-b border-border-subtle no-underline transition-colors hover:bg-inset",
        inset && "px-s4",
      )}
    >
      <Icon glyph={ALERT_TYPE_ICONS[alert.type]} className={SEVERITY_INK[alert.severity]} />
      <span className="grow truncate text-label text-text-1">{titleOf(alert)}</span>
      <span className="shrink-0 text-caption text-text-3">{formatRelative(alert.createdAt)}</span>
      <Icon glyph={ChevronRight} className="shrink-0 text-text-3" />
    </Link>
  );
}
