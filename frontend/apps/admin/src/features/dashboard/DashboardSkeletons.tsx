import { useTranslation } from "@sethu/i18n";

import { Skeleton, SkeletonList } from "../../components/ui/Skeleton";

const KPI_TILE_COUNT = 4;

export interface KpiSkeletonProps {
  layout: "row" | "grid";
}

/**
 * Skeletons, never a spinner. The placeholders hold the exact geometry of the thing arriving — four
 * tiles, then the queue rows — so the layout does not jump when data lands and the manager's eye is
 * already parked on the KPI she came for (spec §4.10).
 */
export function KpiSkeleton({ layout }: KpiSkeletonProps) {
  const { t } = useTranslation("adminDashboard");

  return (
    <div
      className={layout === "row" ? "kpi-row" : "kpi-grid"}
      role="status"
      aria-busy
      aria-label={t("kpi.loading")}
    >
      {Array.from({ length: KPI_TILE_COUNT }, (_unused, index) => (
        // A tile is its 16px padding plus label + value + footer. No single token names that
        // height, so it is composed from tokens rather than typed as a magic number — the point of
        // the skeleton is that the numbers land in place instead of pushing the page down.
        <Skeleton
          key={index}
          className="w-full h-[calc(var(--spacing-row-72)+var(--spacing-s8)+var(--spacing-s2))]"
        />
      ))}
    </div>
  );
}

export interface AttentionSkeletonProps {
  rows: number;
  /** The table keeps its column headers rendered while the rows arrive — see the caller. */
  rowHeight?: string;
}

export function AttentionSkeleton({ rows, rowHeight = "h-row-56" }: AttentionSkeletonProps) {
  const { t } = useTranslation("adminDashboard");
  return <SkeletonList rows={rows} rowClassName={rowHeight} label={t("attention.loading")} />;
}

export function ActivitySkeleton({ rows }: { rows: number }) {
  const { t } = useTranslation("adminDashboard");

  return (
    <div role="status" aria-busy aria-label={t("activity.loading")}>
      {Array.from({ length: rows }, (_unused, index) => (
        <div key={index} className="flex items-center gap-s2 h-row-40">
          <Skeleton className="size-s2 rounded-full flex-none" />
          <Skeleton shape="text" className="grow" />
        </div>
      ))}
    </div>
  );
}
