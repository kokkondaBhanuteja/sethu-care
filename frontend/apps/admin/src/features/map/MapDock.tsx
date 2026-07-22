import { useTranslation } from "@sethu/i18n";

import { isMarkerSetEmpty } from "./map.selectors";
import { MapAttentionList } from "./MapAttentionList";
import { MapLayerToggles } from "./MapLayerToggles";
import { MapMarkersEmpty } from "./MapMarkersEmpty";
import { MapProviderList } from "./MapProviderList";
import { MapSummary } from "./MapSummary";
import type { LiveMapController } from "./useLiveMap";
import type { LiveMapSnapshot } from "./map.types";

export interface MapDockProps {
  controller: LiveMapController;
  snapshot: LiveMapSnapshot;
  focusedZoneName: string | null;
  zoneNameOf: (zoneId: string) => string;
}

/**
 * The 320px right dock — desktop's answer to mobile's bottom sheet. A sheet here would cover the
 * southern third of the city, which is exactly the ground the manager is inspecting when she opens
 * the panel (BOX 24). It is also the accessible equivalent of the canvas: every marker is a row.
 */
export function MapDock({ controller, snapshot, focusedZoneName, zoneNameOf }: MapDockProps) {
  const { t } = useTranslation("adminMap");
  const { markers, layers, isFiltered } = controller;

  return (
    <aside className="map-dock" aria-label={t("summary.heading")}>
      <MapSummary
        heading={t("summary.heading")}
        activeJobCount={snapshot.activeJobCount}
        onlineProviderCount={snapshot.onlineProviderCount}
        freshness={controller.freshness}
        focusedZoneName={focusedZoneName}
        onClearFocus={controller.clearFilters}
      />

      <MapLayerToggles
        heading={t("layers.heading")}
        layers={layers}
        onToggle={controller.toggleLayer}
      />

      <hr className="border-0 border-t border-border-subtle" />

      {isMarkerSetEmpty(markers) ? (
        <MapMarkersEmpty isFiltered={isFiltered} onClearFilters={controller.clearFilters} />
      ) : (
        <>
          <MapAttentionList items={markers.attention} zoneNameOf={zoneNameOf} />
          <MapProviderList providers={markers.providers} zoneNameOf={zoneNameOf} />
        </>
      )}
    </aside>
  );
}
