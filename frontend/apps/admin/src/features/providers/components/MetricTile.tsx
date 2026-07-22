import { useTranslation } from "@sethu/i18n";
import { ProgressBar } from "@sethu/ui-web";

import { cx } from "../../../lib/cx";
import { formatPercent } from "../../../lib/format";
import { metricLabelKey } from "../providers.constants";
import { METRIC_BANDS, METRIC_UNITS } from "../providers.types";
import type { MetricBand, ProviderMetric } from "../providers.types";
import { SectionLabel } from "./SectionLabel";

const BAND_TEXT = {
  [METRIC_BANDS.good]: "text-success",
  [METRIC_BANDS.watch]: "text-warning",
  [METRIC_BANDS.poor]: "text-danger",
} as const;

const BAND_STROKE = {
  [METRIC_BANDS.good]: "text-success",
  [METRIC_BANDS.watch]: "text-text-3",
  [METRIC_BANDS.poor]: "text-danger",
} as const;

/** ProgressBar tones per §6.16 band — the bar restates the number's verdict, never replaces it. */
const BAND_BAR_TONE = {
  [METRIC_BANDS.good]: "success",
  [METRIC_BANDS.watch]: "warning",
  [METRIC_BANDS.poor]: "danger",
} as const;

const SPARK_WIDTH = 56;
const SPARK_HEIGHT = 20;

export interface MetricTileProps {
  metric: ProviderMetric;
  /** Desktop draws the 90-day trend (bar or sparkline) under the value; mobile has no room. */
  showTrend?: boolean;
}

/**
 * One performance figure against its §6.16 target, on the inset tile fill the KPI language uses.
 * Rates additionally read as a ProgressBar; counts and ratings keep the sparkline. The label
 * stays neutral whatever the band is — colour is an addition to the reading, never the only
 * carrier of it (spec §4.8).
 *
 * Built here rather than on `KpiTile` because that primitive has no semantic tone for its value,
 * which is the entire point of this tile. See the feature CLAUDE.md.
 */
export function MetricTile({ metric, showTrend = false }: MetricTileProps) {
  const { t } = useTranslation("adminProviders");
  const isRate = metric.unit === METRIC_UNITS.percent;
  const label = t(metricLabelKey(metric.id));

  return (
    <div className="flex flex-col gap-1 rounded-lg bg-inset p-3">
      <SectionLabel className="min-h-s8">{label}</SectionLabel>
      <span className={cx("text-kpi-sm font-semibold tabular-nums", BAND_TEXT[metric.band])}>
        {formatMetric(metric)}
      </span>
      {showTrend && isRate ? (
        <ProgressBar
          value={metric.value * 100}
          label={label}
          tone={BAND_BAR_TONE[metric.band]}
          trackClassName="bg-surface"
        />
      ) : null}
      {showTrend && !isRate && metric.trend.length > 1 ? (
        <Sparkline points={metric.trend} band={metric.band} />
      ) : null}
    </div>
  );
}

function formatMetric(metric: ProviderMetric): string {
  if (metric.unit === METRIC_UNITS.percent) return formatPercent(metric.value);
  return String(metric.value);
}

function Sparkline({ points, band }: { points: readonly number[]; band: MetricBand }) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      preserveAspectRatio="none"
      className={cx("w-full h-s5", BAND_STROKE[band])}
    >
      <path d={sparkPath(points)} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

/** Maps the series onto the 56x20 viewBox, inverted because SVG y grows downward. */
function sparkPath(points: readonly number[]): string {
  const lowest = Math.min(...points);
  const highest = Math.max(...points);
  const span = highest - lowest || 1;
  const step = SPARK_WIDTH / (points.length - 1);

  return points
    .map((point, index) => {
      const xCoordinate = Math.round(index * step);
      const yCoordinate = Math.round(SPARK_HEIGHT - ((point - lowest) / span) * SPARK_HEIGHT);
      return `${index === 0 ? "M" : "L"}${xCoordinate} ${yCoordinate}`;
    })
    .join(" ");
}
