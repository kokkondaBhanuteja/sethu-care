import { ChartColumn } from "lucide-react";
import { useTranslation } from "@sethu/i18n";
import { CardContent, CardHeader, IconChip } from "@sethu/ui-web";

import { Card } from "../../../components/ui/Card";
import { PROVIDER_METRICS, type ProviderMetric } from "../providers.types";
import { MetricTile } from "./MetricTile";
import { SectionLabel } from "./SectionLabel";

export interface ProviderMetricsProps {
  metrics: readonly ProviderMetric[];
  variant: "desktop" | "mobile";
}

/**
 * Performance over 90 days under a soft-green chart header, led by ESCALATION RATE and carrying
 * no acceptance rate at all: jobs here are auto-assigned, so a provider has nothing to accept and
 * an acceptance figure would be a metric for a product that does not exist. The note says so out
 * loud, because ops managers arriving from other marketplaces will hunt for it
 * (docs/Booking-Workflow-Decisions.md).
 */
export function ProviderMetrics({ metrics, variant }: ProviderMetricsProps) {
  const { t } = useTranslation("adminProviders");
  // Escalation is the headline metric, so it takes the full row; the remaining four fill a 2×2 —
  // five tiles in a plain 2/3-column grid always left a hole.
  const escalationMetric = metrics.find((metric) => metric.id === PROVIDER_METRICS.escalation);
  const supportingMetrics = metrics.filter((metric) => metric.id !== PROVIDER_METRICS.escalation);

  if (variant === "mobile") {
    return (
      <div className="px-s4 py-s4">
        <SectionLabel className="mb-s3">{t("profile.performanceShort")}</SectionLabel>
        <div className="grid grid-cols-2 gap-s2">
          {metrics.map((metric) => (
            <MetricTile key={metric.id} metric={metric} />
          ))}
        </div>
        <p className="mt-s3 text-caption text-text-3">{t("profile.performanceNote")}</p>
      </div>
    );
  }

  return (
    <Card density="flush">
      <CardHeader
        icon={
          <IconChip accent="green" look="soft">
            <ChartColumn aria-hidden />
          </IconChip>
        }
      >
        {t("profile.performance")}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {escalationMetric ? (
            <div className="col-span-2">
              <MetricTile metric={escalationMetric} showTrend />
            </div>
          ) : null}
          {supportingMetrics.map((metric) => (
            <MetricTile key={metric.id} metric={metric} showTrend />
          ))}
        </div>
        <p className="mt-3 text-sm text-faint">{t("profile.performanceNote")}</p>
      </CardContent>
    </Card>
  );
}
