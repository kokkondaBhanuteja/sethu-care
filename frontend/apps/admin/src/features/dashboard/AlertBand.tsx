import { BellRing, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Banner } from "../../components/ui/Banner";
import { Icon } from "../../components/ui/Icon";
import { formatAge } from "../../lib/format";
import { ROUTES } from "../../routes/routes.constants";
import { ALERT_BAND_CAP } from "./dashboard.constants";
import type { AlertBandExample, AlertBandState } from "./dashboard.types";
import { usePriorityLabel } from "./usePriorityLabel";

export interface AlertBandProps {
  band: AlertBandState;
  /** Desktop's full-bleed strip carries a "View all" link; mobile is a tappable row. */
  variant: "desktop" | "mobile";
}

/**
 * Non-dismissible by design: an admin who can swipe away an escalation will, during a busy moment,
 * and then forget. It leaves only when the underlying alert is acknowledged — the act that creates
 * accountability (spec §6.5). It renders nothing at all on a healthy day, because a band that
 * sometimes says "nothing" trains the eye to ignore it.
 */
export function AlertBand({ band, variant }: AlertBandProps) {
  const { t } = useTranslation("adminDashboard");
  const priorityLabel = usePriorityLabel();

  if (band.criticalCount === 0) return null;

  const title =
    band.criticalCount > ALERT_BAND_CAP
      ? t("band.countCapped")
      : band.criticalCount === 1
        ? t("band.countOne")
        : t("band.countOther", { count: band.criticalCount });

  // Two example lines and no further: the band is a pointer into the queue, not the queue itself,
  // and letting it grow with the backlog pushes the KPIs off screen on the day they matter most.
  const detail = band.examples.slice(0, 2).map((example: AlertBandExample) => (
    <span key={example.bookingRef} className="block">
      {t("band.example", {
        reason: priorityLabel(example.priority),
        booking: example.bookingRef,
        age: formatAge(example.surfacedAt),
      })}
    </span>
  ));

  if (variant === "mobile") {
    return (
      <Link to={ROUTES.liveAttention} aria-label={t("band.open")} className="contents">
        <Banner
          tone="danger"
          icon={BellRing}
          title={title}
          detail={detail}
          actions={<Icon glyph={ChevronRight} className="text-text-3" />}
        />
      </Link>
    );
  }

  return (
    <Banner
      tone="danger"
      icon={BellRing}
      title={title}
      detail={detail}
      className="banner--wide"
      actions={
        <Link to={ROUTES.liveAttention} className="text-brand text-body">
          {t("band.viewAll")}
        </Link>
      }
    />
  );
}
