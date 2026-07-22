import { useTranslation } from "@sethu/i18n";

import { Card } from "../../../components/ui/Card";
import { cx } from "../../../lib/cx";
import type { ProviderMetric } from "../providers.types";
import { MetricTile } from "./MetricTile";
import { SectionLabel } from "./SectionLabel";

export interface ProviderMetricsProps {
  metrics: readonly ProviderMetric[];
  variant: "desktop" | "mobile";
}

/**
 * Performance over 90 days, led by ESCALATION RATE and carrying no acceptance rate at all: jobs
 * here are auto-assigned, so a provider has nothing to accept and an acceptance figure would be a
 * metric for a product that does not exist. The note says so out loud, because ops managers
 * arriving from other marketplaces will hunt for it (docs/Booking-Workflow-Decisions.md).
 */
export function ProviderMetrics({ metrics, variant }: ProviderMetricsProps) {
  const { t } = useTranslation("adminProviders");
  const isDesktop = variant === "desktop";

  const body = (
    <>
      <SectionLabel className="mb-s3">
        {isDesktop ? t("profile.performance") : t("profile.performanceShort")}
      </SectionLabel>
      <div className={cx("grid gap-s2", isDesktop ? "grid-cols-5" : "grid-cols-2")}>
        {metrics.map((metric) => (
          <MetricTile key={metric.id} metric={metric} showTrend={isDesktop} />
        ))}
      </div>
      <p className="mt-s3 text-caption text-text-3">{t("profile.performanceNote")}</p>
    </>
  );

  return isDesktop ? <Card>{body}</Card> : <div className="px-s4 py-s4">{body}</div>;
}
