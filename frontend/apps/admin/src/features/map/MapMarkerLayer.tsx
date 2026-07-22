import { useTranslation } from "@sethu/i18n";

import { formatRelative } from "../../lib/format";
import { MAX_DOM_MARKERS } from "./map.constants";
import { JOB_STATE_KEYS, PROVIDER_STATUS_KEYS } from "./map.labels";
import { isWithinViewport, projectPoint, type ScreenOffset } from "./map.projection";
import { MapMarker, MapZoneLabel } from "./MapMarker";
import { ClusterGlyph, JobGlyph, ProviderGlyph } from "./MapMarkerGlyph";
import { PROVIDER_MAP_STATUSES } from "./map.types";
import type { VisibleMarkers } from "./map.selectors";
import type { MapCluster, MapJob, MapPoint, MapProvider, MapViewport, MapZone } from "./map.types";

export interface MapMarkerLayerProps {
  viewport: MapViewport;
  markers: VisibleMarkers;
  zones: readonly MapZone[];
  zoneNameOf: (zoneId: string) => string;
  onSelectProvider: (provider: MapProvider) => void;
  onSelectJob: (job: MapJob) => void;
  onSelectCluster: (cluster: MapCluster) => void;
}

/**
 * Places every marker for the current viewport. Only the current viewport plus a 20% buffer is
 * rendered and the total is hard-capped, because a phone that drops frames while an operator is
 * hunting an escalation is worse than a map missing its 201st pin (spec §6.7 performance rules).
 */
export function MapMarkerLayer({
  viewport,
  markers,
  zones,
  zoneNameOf,
  onSelectProvider,
  onSelectJob,
  onSelectCluster,
}: MapMarkerLayerProps) {
  const { t } = useTranslation("adminMap");

  const jobs = withinViewport(markers.jobs, viewport);
  const providers = withinViewport(markers.providers, viewport).slice(
    0,
    Math.max(0, MAX_DOM_MARKERS - jobs.length),
  );
  const clusters = withinViewport(markers.clusters, viewport);

  return (
    <>
      {zones.map((zone) => (
        <MapZoneLabel
          key={zone.id}
          offset={projectPoint(zone.labelAt, viewport)}
          name={zone.name}
        />
      ))}

      {providers.map(({ item: provider, offset }) => (
        <MapMarker
          key={provider.id}
          offset={offset}
          label={providerLabel(provider)}
          onSelect={() => onSelectProvider(provider)}
        >
          <ProviderGlyph
            status={provider.status}
            statusLabel={t(PROVIDER_STATUS_KEYS[provider.status])}
          />
        </MapMarker>
      ))}

      {jobs.map(({ item: job, offset }) => (
        <MapMarker
          key={job.id}
          offset={offset}
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
      ))}

      {clusters.map(({ item: cluster, offset }) => (
        <MapMarker
          key={cluster.id}
          offset={offset}
          label={t("marker.cluster", {
            count: cluster.markerCount,
            zone: zoneNameOf(cluster.zoneId),
          })}
          onSelect={() => onSelectCluster(cluster)}
        >
          <ClusterGlyph count={cluster.markerCount} />
        </MapMarker>
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

interface Placed<TItem> {
  readonly item: TItem;
  readonly offset: ScreenOffset;
}

function withinViewport<TItem extends { readonly position: MapPoint }>(
  items: readonly TItem[],
  viewport: MapViewport,
): readonly Placed<TItem>[] {
  return items
    .map((item) => ({ item, offset: projectPoint(item.position, viewport) }))
    .filter((placed) => isWithinViewport(placed.offset));
}
