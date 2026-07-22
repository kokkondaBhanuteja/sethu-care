import { useTranslation } from "@sethu/i18n";
import { CardContent, CardHeader } from "@sethu/ui-web";

import { Card } from "../../components/ui/Card";
import { cx } from "../../lib/cx";
import { AlertNoticeRow } from "./AlertNoticeRow";
import type { Alert } from "./alerts.types";

export interface AlertNoticeListProps {
  today: readonly Alert[];
  earlier: readonly Alert[];
  inset?: boolean;
  /** Kept for the two call sites' layout contract; the tier heading now always renders. */
  showTierLabel?: boolean;
}

/**
 * The informational tier as the calm half of the feed's two-card structure: a plain Card, a muted
 * heading, bare rows grouped Today / Earlier (spec §6.20) — no tints, no rails, no buttons, so
 * the danger-edged needs-action Card above keeps its claim on attention. Being caught up means no
 * alert is waiting on a decision — not that the day had no events, so this list stays even when
 * the needs-action tier is gone.
 */
export function AlertNoticeList({ today, earlier, inset = false }: AlertNoticeListProps) {
  const { t } = useTranslation("adminAlerts");

  // No events at all (or all filtered away): no empty shell — absence of noise is the design.
  if (today.length === 0 && earlier.length === 0) return null;

  return (
    <section aria-label={t("informational")} className={cx("mt-6", inset && "px-s4")}>
      <Card density="flush">
        <CardHeader className="pb-2 sm:pb-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            {t("informational")}
          </h2>
        </CardHeader>

        <CardContent>
          {today.length > 0 ? (
            <>
              <h3 className="mb-1 text-xs uppercase tracking-wide text-faint">{t("today")}</h3>
              {today.map((alert) => (
                <AlertNoticeRow key={alert.id} alert={alert} />
              ))}
            </>
          ) : null}

          {earlier.length > 0 ? (
            <>
              <h3 className="mb-1 mt-4 text-xs uppercase tracking-wide text-faint">
                {t("earlier")}
              </h3>
              {earlier.map((alert) => (
                <AlertNoticeRow key={alert.id} alert={alert} />
              ))}
            </>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
