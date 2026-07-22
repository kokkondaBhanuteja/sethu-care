import { cx } from "../../lib/cx";

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
  className?: string;
}

const SPARK_WIDTH = 56;
const SPARK_HEIGHT = 20;

export function KpiTile({ label, value, trend, sparkline, className }: KpiTileProps) {
  return (
    <div className={cx("kpi-tile", className)}>
      <div className="kpi-tile__label">{label}</div>
      <div className="kpi-tile__value">{value}</div>
      {trend || sparkline ? (
        <div className="kpi-tile__foot">
          {trend ? (
            <span className={cx("trend", trend.isGood ? "trend--good" : "trend--bad")}>
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
              className={cx(
                "sparkline",
                trend?.isGood === false ? "sparkline--bad" : "sparkline--good",
              )}
              viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
              aria-hidden
            >
              <path d={sparklinePath(sparkline)} />
            </svg>
          ) : null}
        </div>
      ) : null}
    </div>
  );
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
