import type { ReactNode } from "react";
import { ClipboardList, ShieldCheck, Timer, Wallet } from "lucide-react";
import { useTranslation } from "@sethu/i18n";
import { KpiTile, cn } from "@sethu/ui-web";

import { formatDuration, formatMoneyCompact, formatPercent } from "../../lib/format";
import {
  DASHBOARD_PERIODS,
  type DashboardPeriod,
  type DashboardSummary,
  type KpiDelta,
} from "./dashboard.types";

export interface KpiTilesProps {
  summary: DashboardSummary;
  /** Which window the figures describe — the caption states it beside the numbers. */
  period: DashboardPeriod;
}

/**
 * Bookings · Revenue · Completion · Avg assign (spec §6.5), on the ui-web KpiTile: vivid solid
 * IconChip, muted caption, text-kpi number, semantic trend line. Two tiles per row on narrow
 * canvases, the full strip of four from `lg:` up. The strip captions its own period ("Today so
 * far" / "Live right now"): the Today|Live toggle sits in the far corner of the topbar, and a
 * bare number whose window lives elsewhere gets misread (UX audit).
 *
 * Every value is formatted through lib/format — nothing here builds a number string itself.
 * Trend colour is SEMANTIC, never directional: a rising assignment time is bad news, so its
 * up-arrow line is red. Under Booking-Workflow-Decisions D3 that figure measures the automation,
 * and a manual assignment is the anomaly worth noticing.
 */
export function KpiTiles({ summary, period }: KpiTilesProps) {
  const { t } = useTranslation("adminDashboard");
  const hasData = summary.bookings > 0;
  const dash = t("kpi.noValue");

  return (
    <div role="group" aria-label={t("kpi.sectionLabel")}>
      <p className="mb-2 text-xs font-medium text-faint">
        {period === DASHBOARD_PERIODS.today ? t("kpi.periodToday") : t("kpi.periodLive")}
      </p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile
          label={t("kpi.bookings")}
          value={hasData ? String(summary.bookings) : dash}
          icon={<ClipboardList />}
          accent="blue"
          delta={trendLine(summary.bookingsDelta, formatPercent, hasData)}
        />
        <KpiTile
          label={t("kpi.revenue")}
          value={hasData ? formatMoneyCompact(summary.revenuePaise) : dash}
          icon={<Wallet />}
          accent="green"
          delta={trendLine(summary.revenueDelta, formatPercent, hasData)}
        />
        <KpiTile
          label={t("kpi.completion")}
          value={hasData ? formatPercent(summary.completionRate) : dash}
          icon={<ShieldCheck />}
          accent="purple"
          delta={trendLine(summary.completionDelta, formatPercent, hasData)}
        />
        <KpiTile
          label={t("kpi.avgAssign")}
          value={hasData ? formatDuration(summary.avgAssignMs) : dash}
          icon={<Timer />}
          accent="amber"
          delta={trendLine(summary.avgAssignDelta, formatDuration, hasData)}
        />
      </div>
    </div>
  );
}

interface TrendInfo {
  /** Rendered magnitude, e.g. "12%" or "40s". Direction comes from `direction`. */
  readonly delta: string;
  readonly direction: "up" | "down";
  /** Whether this movement is good news — the ONLY thing that decides the colour. */
  readonly isGood: boolean;
}

function trendLine(
  delta: KpiDelta,
  format: (magnitude: number) => string,
  hasData: boolean,
): ReactNode {
  if (!hasData || delta.value === 0) return undefined;
  return (
    <TrendLine
      trend={{
        delta: format(Math.abs(delta.value)),
        direction: delta.value > 0 ? "up" : "down",
        isGood: delta.isGood,
      }}
    />
  );
}

function TrendLine({ trend }: { trend: TrendInfo }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold",
        trend.isGood ? "text-success-fg" : "text-danger-fg",
      )}
    >
      {/* The glyph alone announces as "black up-pointing triangle"; the direction word carries
          the meaning for assistive tech, and "better"/"worse" carries the tone, because up is not
          reliably good here (rising assign time is bad news). */}
      <span aria-hidden>{trend.direction === "up" ? "▲" : "▼"}</span>
      <span className="sr-only">
        {trend.direction === "up" ? "up" : "down"} {trend.delta},{" "}
        {trend.isGood ? "better" : "worse"}
      </span>
      <span aria-hidden>{trend.delta}</span>
    </span>
  );
}
