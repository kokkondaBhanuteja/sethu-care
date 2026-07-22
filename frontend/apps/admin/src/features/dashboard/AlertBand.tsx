import { BellRing, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";
import { Card, IconChip, buttonVariants, cn } from "@sethu/ui-web";

import { Icon } from "../../components/ui/Icon";
import { formatAge } from "../../lib/format";
import { ALERT_BAND_CAP, ESCALATED_ATTENTION_LINK } from "./dashboard.constants";
import type { AlertBandExample, AlertBandState } from "./dashboard.types";
import { usePriorityLabel } from "./usePriorityLabel";

export interface AlertBandProps {
  band: AlertBandState;
  /** Desktop's card carries a "View all" outline button; mobile is one tappable card. */
  variant: "desktop" | "mobile";
  className?: string;
}

/**
 * The escalation band, restyled as the tinted danger feature card: solid red chip, the count as
 * the headline, "View all" as the way in — prominent but composed, never a raw full-width bar.
 * It counts CRITICAL ESCALATIONS and says exactly that: "needs attention" is the queue's phrase,
 * and using it here made "2 need attention" sit over a sidebar saying "Needs attention · 7"
 * (UX audit — one vocabulary per concept). Its link lands on the queue pre-filtered to the
 * escalations it was counting. Mobile cites the worst items beneath the headline; desktop does
 * not, because the queue table opens directly below the band and the examples duplicated its rows.
 *
 * Non-dismissible by design: an admin who can swipe away an escalation will, during a busy moment,
 * and then forget. It leaves only when the underlying alert is acknowledged — the act that creates
 * accountability (spec §6.5). It renders nothing at all on a healthy day, because a band that
 * sometimes says "nothing" trains the eye to ignore it.
 */
export function AlertBand({ band, variant, className }: AlertBandProps) {
  const { t } = useTranslation("adminDashboard");
  const priorityLabel = usePriorityLabel();

  if (band.criticalCount === 0) return null;

  const title =
    band.criticalCount > ALERT_BAND_CAP
      ? t("band.countCapped")
      : band.criticalCount === 1
        ? t("band.countOne")
        : t("band.countOther", { count: band.criticalCount });

  // Two example lines and no further, and on MOBILE only: the band is a pointer into the queue,
  // not the queue itself, and on desktop the queue table already sits directly beneath it.
  const detail =
    variant === "mobile"
      ? band.examples.slice(0, 2).map((example: AlertBandExample) => (
          <span key={example.bookingRef} className="block">
            {t("band.example", {
              reason: priorityLabel(example.priority),
              booking: example.bookingRef,
              age: formatAge(example.surfacedAt),
            })}
          </span>
        ))
      : [];

  const body = (
    <>
      <IconChip accent="red" look="solid">
        <BellRing />
      </IconChip>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-danger-fg">{title}</p>
        {detail.length > 0 ? <div className="mt-0.5 text-sm text-ink">{detail}</div> : null}
      </div>
    </>
  );

  if (variant === "mobile") {
    return (
      <Link to={ESCALATED_ATTENTION_LINK} aria-label={t("band.open")} className="block">
        <Card tone="danger" role="alert" className={cn("flex items-center gap-3 p-4", className)}>
          {body}
          <Icon glyph={ChevronRight} className="text-danger-fg" />
        </Card>
      </Link>
    );
  }

  return (
    <Card
      tone="danger"
      role="alert"
      className={cn("flex items-center gap-4 p-4 sm:p-5", className)}
    >
      {body}
      <Link
        to={ESCALATED_ATTENTION_LINK}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
      >
        {t("band.viewAll")}
      </Link>
    </Card>
  );
}
