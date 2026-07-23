import { useTranslation } from "@sethu/i18n";
import type { Map as MapLibreMap } from "maplibre-gl";

import { formatRelative } from "../../lib/format";
import { MAP_VIEWPORT_BUFFER_RATIO, MAX_DOM_MARKERS } from "./map.constants";
import { JOB_STATE_KEYS, PROVIDER_STATUS_KEYS } from "./map.labels";
import { boundsWithBuffer, isWithinBounds } from "./map.projection";
import { MapLibrePoint, MapMarker, MapZoneLabel } from "./MapMarker";
import { ClusterGlyph, JobGlyph, ProviderGlyph } from "./MapMarkerGlyph";
import { JOB_MAP_STATES, PROVIDER_MAP_STATUSES, hasMapPosition } from "./map.types";
import type { PlainBounds } from "./map.projection";
import type { VisibleMarkers } from "./map.selectors";
import type { MapClusteringController } from "./useMapClustering";
import type { MapPoint, MapProvider, MapZone } from "./map.types";
import type { MapCluster, MapJob } from "./map.types";

export interface MapMarkerLayerProps {
  mapInstance: MapLibreMap;
  visibleBounds: PlainBounds | null;
  markers: VisibleMarkers;
  clustering: MapClusteringController;
  zones: readonly MapZone[];
  zoneNameOf: (zoneId: string) => string;
  onSelectProvider: (provider: MapProvider) => void;
  onSelectJob: (job: MapJob) => void;
  onSelectCluster: (cluster: MapCluster) => void;
}

/**
 * Places every marker as a MapLibre-positioned HTML button. Only the viewport plus a 20% buffer is
 * rendered and the total is hard-capped, because a phone that drops frames while an operator is
 * hunting an escalation is worse than a map missing its 201st pin (spec §6.7 performance rules).
 * Above 50 pins the cluster engine's grouping replaces individual placement — except escalations,
 * which always surface as their own pulsing marker.
 */
export function MapMarkerLayer({
  mapInstance,
  visibleBounds,
  markers,
  clustering,
  zones,
  zoneNameOf,
  onSelectProvider,
  onSelectJob,
  onSelectCluster,
}: MapMarkerLayerProps) {
  const { t } = useTranslation("adminMap");

  const bufferedBounds =
    visibleBounds === null ? null : boundsWithBuffer(visibleBounds, MAP_VIEWPORT_BUFFER_RATIO);
  const isVisible = (position: MapPoint): boolean =>
    bufferedBounds === null || isWithinBounds(position, bufferedBounds);
  const isUnclustered = (markerId: string): boolean =>
    clustering.unclusteredMarkerIds === null || clustering.unclusteredMarkerIds.has(markerId);

  // Unpositioned markers (the real payload's coordinate gap — map.api.map.ts) are list-only:
  // they never reach the canvas, because a pin at a made-up place is worse than no pin.
  const jobs = markers.jobs
    .filter(hasMapPosition)
    .filter((job) => isVisible(job.position))
    .filter((job) => job.state === JOB_MAP_STATES.escalated || isUnclustered(job.id));
  const providers = markers.providers
    .filter(hasMapPosition)
    .filter((provider) => isVisible(provider.position) && isUnclustered(provider.id))
    .slice(0, Math.max(0, MAX_DOM_MARKERS - jobs.length));
  const serverClusters = markers.clusters.filter((cluster) => isVisible(cluster.position));

  return (
    <>
      {zones.map((zone) => (
        <MapLibrePoint key={`zone-${zone.id}`} mapInstance={mapInstance} position={zone.labelAt}>
          <MapZoneLabel name={zone.name} />
        </MapLibrePoint>
      ))}

      {providers.map((provider) => (
        <MapLibrePoint key={provider.id} mapInstance={mapInstance} position={provider.position}>
          <MapMarker label={providerLabel(provider)} onSelect={() => onSelectProvider(provider)}>
            <ProviderGlyph
              status={provider.status}
              statusLabel={t(PROVIDER_STATUS_KEYS[provider.status])}
            />
          </MapMarker>
        </MapLibrePoint>
      ))}

      {jobs.map((job) => (
        <MapLibrePoint key={job.id} mapInstance={mapInstance} position={job.position}>
          <MapMarker
            label={t("marker.job", {
              ref: job.bookingRef,
              service: job.serviceName,
              state: t(JOB_STATE_KEYS[job.state]),
              zone: zoneNameOf(job.zoneId),
            })}
            onSelect={() => onSelectJob(job)}
          >
            <JobGlyph state={job.state} />
          </MapMarker>
        </MapLibrePoint>
      ))}

      {serverClusters.map((cluster) => (
        <MapLibrePoint key={cluster.id} mapInstance={mapInstance} position={cluster.position}>
          <MapMarker
            label={t("marker.cluster", {
              count: cluster.markerCount,
              zone: zoneNameOf(cluster.zoneId),
            })}
            onSelect={() => onSelectCluster(cluster)}
          >
            <ClusterGlyph count={cluster.markerCount} />
          </MapMarker>
        </MapLibrePoint>
      ))}

      {clustering.engineClusters.map((engineCluster) => (
        <MapLibrePoint
          key={`engine-${engineCluster.clusterId}`}
          mapInstance={mapInstance}
          position={engineCluster.position}
        >
          <MapMarker
            label={t("marker.clusterZoom", { count: engineCluster.markerCount })}
            onSelect={() => clustering.expandCluster(engineCluster)}
          >
            <ClusterGlyph count={engineCluster.markerCount} />
          </MapMarker>
        </MapLibrePoint>
      ))}
    </>
  );

  function providerLabel(provider: MapProvider): string {
    const zone = zoneNameOf(provider.zoneId);
    if (provider.status === PROVIDER_MAP_STATUSES.offline) {
      return t("marker.providerOffline", {
        name: provider.name,
        age: formatRelative(provider.locatedAt),
        zone,
      });
    }
    return t("marker.provider", {
      name: provider.name,
      status: t(PROVIDER_STATUS_KEYS[provider.status]),
      zone,
    });
  }
}
