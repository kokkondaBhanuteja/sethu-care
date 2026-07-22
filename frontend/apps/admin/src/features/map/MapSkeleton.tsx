import { Skeleton } from "../../components/ui/Skeleton";

const DOCK_ROWS = [0, 1, 2, 3, 4];

export interface MapSkeletonProps {
  surface: "desktop" | "mobile";
}

/**
 * The first-load placeholder, shaped like the screen that is arriving — a canvas with a docked
 * panel, or a canvas with a bottom peek. Never a spinner for content: the design forbids one
 * precisely so the layout does not jump when the snapshot lands (spec §4.10).
 */
export function MapSkeleton({ surface }: MapSkeletonProps) {
  if (surface === "mobile") {
    return (
      <div className="grow min-h-0 relative bg-surface">
        <div className="absolute inset-x-0 bottom-0 bg-canvas rounded-t-sheet shadow-sheet p-s4 flex flex-col gap-s3">
          <Skeleton shape="text" className="w-1/2" />
          <Skeleton className="w-full h-row-56" />
          <Skeleton className="w-full h-row-56" />
        </div>
      </div>
    );
  }

  return (
    <div className="map-wrap">
      <div className="map-canvas" />
      <aside className="map-dock">
        <Skeleton shape="text" className="w-2/3" />
        <div className="flex flex-col gap-s3">
          {DOCK_ROWS.map((row) => (
            <Skeleton key={row} className="w-full h-row-48" />
          ))}
        </div>
        <Skeleton className="w-full h-row-56" />
        <Skeleton className="w-full h-row-56" />
      </aside>
    </div>
  );
}
