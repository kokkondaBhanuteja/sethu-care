import { KpiTile as UiKpiTile, cn } from "@sethu/ui-web";

export interface KpiTrend {
  /** Rendered text, e.g. "12%" or "40s". Direction comes from `direction`. */
  readonly delta: string;
  readonly direction: "up" | "down";
  /**
   * Whether this movement is good news. Trend colour is SEMANTIC, never directional: rising
   * assignment time is bad, so its up-arrow chip is red.
   */
  readonly isGood: boolean;
}

export interface KpiTileProps {
  label: string;
  /** Pre-formatted through lib/format — the tile never formats a number itself. */
  value: string;
  trend?: KpiTrend;
  /** Eight points describing the period, drawn as the tile's sparkline. */
  sparkline?: readonly number[];
  /** A footnote under the value — "Cycle closes 25/07". Replaces the trend row when given. */
  foot?: string;
  className?: string;
}

const SPARK_WIDTH = 56;
const SPARK_HEIGHT = 20;

/**
 * Thin adapter over @sethu/ui-web KpiTile (P3 migration): admin's trend + sparkline render into
 * the ui-web `delta` slot, preserving the accessible "up 12%, better" wording exactly.
 */
export function KpiTile({ label, value, trend, sparkline, foot, className }: KpiTileProps) {
  const deltaSlot = foot ? (
    <span className="text-xs text-faint">{foot}</span>
  ) : trend || sparkline ? (
    <>
      {trend ? (
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs font-semibold",
            trend.isGood ? "text-success-fg" : "text-danger-fg",
          )}
        >
          {/* The glyph alone announces as "black up-pointing triangle"; the direction word
              carries the meaning for assistive tech, and "better"/"worse" carries the tone,
              because up is not reliably good here (rising assign time is bad news). */}
          <span aria-hidden>{trend.direction === "up" ? "▲" : "▼"}</span>
          <span className="sr-only">
            {trend.direction === "up" ? "up" : "down"} {trend.delta},{" "}
            {trend.isGood ? "better" : "worse"}
          </span>
          <span aria-hidden> {trend.delta}</span>
        </span>
      ) : null}
      {sparkline && sparkline.length > 1 ? (
        <svg
          className={cn("h-5 w-14", trend?.isGood === false ? "text-danger-fg" : "text-success-fg")}
          viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          // Lucide geometry: the design draws every stroke at 1.5 (spec §4.9).
          strokeWidth={1.5}
        >
          <path d={sparklinePath(sparkline)} />
        </svg>
      ) : null}
    </>
  ) : undefined;

  return <UiKpiTile label={label} value={value} delta={deltaSlot} className={className} />;
}

/** Maps values onto the 56x20 viewBox, inverted because SVG y grows downward. */
function sparklinePath(values: readonly number[]): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = SPARK_WIDTH / (values.length - 1);

  return values
    .map((point, index) => {
      const x = Math.round(index * step);
      const y = Math.round(SPARK_HEIGHT - ((point - min) / span) * SPARK_HEIGHT);
      return `${index === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");
}
