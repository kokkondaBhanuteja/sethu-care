import type { MapJob, MapZone } from "./map.types";

// The two layers that are OFF by default because each repaints the base map: a demand heatmap and
// the service-area boundaries (BOX 24). Drawn in a percentage viewBox so they share the marker
// layer's coordinate space rather than either street grid's.

const SERVICE_AREA_RADIUS = 14;
const HEAT_INNER_RADIUS = 6;
const HEAT_OUTER_RADIUS = 13;
const HEAT_INNER_OPACITY = 0.22;
const HEAT_OUTER_OPACITY = 0.12;
const BOUNDARY_DASH = "3 2";

export interface MapOverlaysProps {
  zones: readonly MapZone[];
  jobs: readonly MapJob[];
  showServiceAreas: boolean;
  showDemandHeatmap: boolean;
}

export function MapOverlays({
  zones,
  jobs,
  showServiceAreas,
  showDemandHeatmap,
}: MapOverlaysProps) {
  if (!showServiceAreas && !showDemandHeatmap) return null;

  return (
    <svg
      className="map__svg absolute inset-0"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {showDemandHeatmap
        ? zones.map((zone) => (
            <g key={zone.id} className="fill-warning">
              <circle
                cx={zone.labelAt.xPercent}
                cy={zone.labelAt.yPercent}
                r={heatRadius(HEAT_OUTER_RADIUS, zone.id, jobs)}
                opacity={HEAT_OUTER_OPACITY}
              />
              <circle
                cx={zone.labelAt.xPercent}
                cy={zone.labelAt.yPercent}
                r={heatRadius(HEAT_INNER_RADIUS, zone.id, jobs)}
                opacity={HEAT_INNER_OPACITY}
              />
            </g>
          ))
        : null}

      {showServiceAreas
        ? zones.map((zone) => (
            <circle
              key={zone.id}
              cx={zone.labelAt.xPercent}
              cy={zone.labelAt.yPercent}
              r={SERVICE_AREA_RADIUS}
              className="fill-none stroke-border-strong"
              strokeWidth={0.4}
              strokeDasharray={BOUNDARY_DASH}
            />
          ))
        : null}
    </svg>
  );
}

/** Heat is demand: a zone with more running jobs blooms wider. */
function heatRadius(base: number, zoneId: string, jobs: readonly MapJob[]): number {
  const jobsHere = jobs.filter((candidate) => candidate.zoneId === zoneId).length;
  return base * (1 + jobsHere / 4);
}
