import { useTranslation } from "@sethu/i18n";

import { KpiTile, type KpiTrend } from "../../components/ui/KpiTile";
import { formatDuration, formatMoneyCompact, formatPercent } from "../../lib/format";
import type { DashboardSummary, KpiDelta } from "./dashboard.types";

export interface KpiTilesProps {
  summary: DashboardSummary;
  /** Desktop lays the four tiles in one row; mobile keeps the 2x2 grid. */
  layout: "row" | "grid";
}

/**
 * Bookings · Revenue · Completion · Avg assign (spec §6.5).
 *
 * Every value is formatted through lib/format — nothing here builds a number string itself.
 * Trend colour is SEMANTIC, never directional: a rising assignment time is bad news, so its
 * up-arrow chip is red. Under Booking-Workflow-Decisions D3 that figure measures the automation,
 * and a manual assignment is the anomaly worth noticing.
 */
export function KpiTiles({ summary, layout }: KpiTilesProps) {
  const { t } = useTranslation("adminDashboard");
  const hasData = summary.bookings > 0;
  const dash = t("kpi.noValue");

  return (
    <div
      className={layout === "row" ? "kpi-row" : "kpi-grid"}
      role="group"
      aria-label={t("kpi.sectionLabel")}
    >
      <KpiTile
        label={t("kpi.bookings")}
        value={hasData ? String(summary.bookings) : dash}
        {...trendProps(summary.bookingsDelta, formatPercent, hasData)}
        sparkline={summary.sparklines.bookings}
      />
      <KpiTile
        label={t("kpi.revenue")}
        value={hasData ? formatMoneyCompact(summary.revenuePaise) : dash}
        {...trendProps(summary.revenueDelta, formatPercent, hasData)}
        sparkline={summary.sparklines.revenue}
      />
      <KpiTile
        label={t("kpi.completion")}
        value={hasData ? formatPercent(summary.completionRate) : dash}
        {...trendProps(summary.completionDelta, formatPercent, hasData)}
        sparkline={summary.sparklines.completion}
      />
      <KpiTile
        label={t("kpi.avgAssign")}
        value={hasData ? formatDuration(summary.avgAssignMs) : dash}
        {...trendProps(summary.avgAssignDelta, formatDuration, hasData)}
        sparkline={summary.sparklines.avgAssign}
      />
    </div>
  );
}

function trendProps(
  delta: KpiDelta,
  format: (magnitude: number) => string,
  hasData: boolean,
): { trend?: KpiTrend } {
  if (!hasData || delta.value === 0) return {};
  return {
    trend: {
      delta: format(Math.abs(delta.value)),
      direction: delta.value > 0 ? "up" : "down",
      isGood: delta.isGood,
    },
  };
}
