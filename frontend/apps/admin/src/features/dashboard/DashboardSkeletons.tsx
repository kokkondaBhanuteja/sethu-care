import { useTranslation } from "@sethu/i18n";

import { Skeleton, SkeletonList } from "../../components/ui/Skeleton";

const KPI_TILE_COUNT = 4;

/**
 * Skeletons, never a spinner. The placeholders hold the geometry of the thing arriving — four
 * chip-and-number tiles in the responsive KPI grid, then the queue rows — so the layout does not
 * jump when data lands and the manager's eye is already parked on the KPI she came for (§4.10).
 */
export function KpiSkeleton() {
  const { t } = useTranslation("adminDashboard");

  return (
    <div
      className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      role="status"
      aria-busy
      aria-label={t("kpi.loading")}
    >
      {Array.from({ length: KPI_TILE_COUNT }, (_unused, index) => (
        // A tile is its padding plus icon chip, label, text-kpi number and trend line — h-40 on
        // the spacing scale is that stack's height, so the numbers land in place instead of
        // pushing the page down.
        <Skeleton key={index} className="h-40 w-full rounded-card" />
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
        <div key={index} className="flex items-center gap-2 py-2">
          <Skeleton className="size-2 flex-none rounded-full" />
          <Skeleton shape="text" className="grow" />
        </div>
      ))}
    </div>
  );
}
