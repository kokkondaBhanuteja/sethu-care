import { useTranslation } from "@sethu/i18n";

import { AlertNoticeRow } from "./AlertNoticeRow";
import type { Alert } from "./alerts.types";

export interface AlertNoticeListProps {
  today: readonly Alert[];
  earlier: readonly Alert[];
  inset?: boolean;
  /** Desktop labels the whole tier once above the day groups; mobile goes straight to the days. */
  showTierLabel?: boolean;
}

/**
 * The informational tier, grouped Today / Earlier (spec §6.20). Being caught up means no alert is
 * waiting on a decision — not that the day had no events, so this list stays even when the
 * needs-action tier is gone.
 */
export function AlertNoticeList({
  today,
  earlier,
  inset = false,
  showTierLabel = false,
}: AlertNoticeListProps) {
  const { t } = useTranslation("adminAlerts");

  return (
    <section aria-label={t("informational")}>
      {showTierLabel ? (
        <h2 className="mt-s5 text-pill tracking-wide text-text-3 uppercase">
          {t("informational")}
        </h2>
      ) : null}

      {today.length > 0 ? (
        <>
          <h3 className="mt-s3 mb-s1 text-caption tracking-wide text-text-3 uppercase">
            {t("today")}
          </h3>
          {today.map((alert) => (
            <AlertNoticeRow key={alert.id} alert={alert} inset={inset} />
          ))}
        </>
      ) : null}

      {earlier.length > 0 ? (
        <>
          <h3 className="mt-s4 mb-s1 text-caption tracking-wide text-text-3 uppercase">
            {t("earlier")}
          </h3>
          {earlier.map((alert) => (
            <AlertNoticeRow key={alert.id} alert={alert} inset={inset} />
          ))}
        </>
      ) : null}
    </section>
  );
}
