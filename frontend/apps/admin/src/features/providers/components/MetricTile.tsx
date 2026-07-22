import { useTranslation } from "@sethu/i18n";

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

const SPARK_WIDTH = 56;
const SPARK_HEIGHT = 20;

export interface MetricTileProps {
  metric: ProviderMetric;
  /** Desktop draws the 90-day trend under the value; the mobile grid does not have the room. */
  showTrend?: boolean;
}

/**
 * One performance figure against its §6.16 target. The label and the sparkline stay whatever the
 * band is — colour is an addition to the reading, never the only carrier of it (spec §4.8).
 *
 * Built here rather than on `KpiTile` because that primitive has no semantic tone for its value,
 * which is the entire point of this tile. See the feature CLAUDE.md.
 */
export function MetricTile({ metric, showTrend = false }: MetricTileProps) {
  const { t } = useTranslation("adminProviders");

  return (
    <div className="flex flex-col gap-s1 rounded-card bg-surface p-s3">
      <SectionLabel className="min-h-s8">{t(metricLabelKey(metric.id))}</SectionLabel>
      <span className={cx("text-section tabular-nums", BAND_TEXT[metric.band])}>
        {formatMetric(metric)}
      </span>
      {showTrend && metric.trend.length > 1 ? (
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
      const x = Math.round(index * step);
      const y = Math.round(SPARK_HEIGHT - ((point - lowest) / span) * SPARK_HEIGHT);
      return `${index === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");
}
