import { useTranslation } from "@sethu/i18n";

import { Sheet } from "../../components/ui/Sheet";
import { MAP_SHEETS, type MapSheet } from "./map.constants";
import { isMarkerSetEmpty } from "./map.selectors";
import { MapAttentionList } from "./MapAttentionList";
import { MapLayerToggles } from "./MapLayerToggles";
import { MapLegend } from "./MapLegend";
import { MapMarkersEmpty } from "./MapMarkersEmpty";
import { MapProviderList } from "./MapProviderList";
import type { LiveMapController } from "./useLiveMap";

export interface MapSheetsProps {
  openSheet: MapSheet;
  onDismiss: () => void;
  controller: LiveMapController;
  zoneNameOf: (zoneId: string) => string;
}

/**
 * Mobile's two sheets, both on the focus-trapped Sheet primitive. The operations sheet is the
 * keyboard-equivalent of the canvas — it lists exactly the markers the map is drawing, so a
 * provider is never reachable only by hitting a 12px pin (spec §6.7; Part 11).
 */
export function MapSheets({ openSheet, onDismiss, controller, zoneNameOf }: MapSheetsProps) {
  const { t } = useTranslation("adminMap");
  const { markers } = controller;

  return (
    <>
      <Sheet
        isOpen={openSheet === MAP_SHEETS.layers}
        title={t("layers.open")}
        onDismiss={onDismiss}
      >
        <div className="flex flex-col gap-s5">
          <MapLayerToggles layers={controller.layers} onToggle={controller.toggleLayer} />
          <MapLegend floating={false} />
        </div>
      </Sheet>

      <Sheet
        isOpen={openSheet === MAP_SHEETS.operations}
        title={t("controls.openOperations")}
        onDismiss={onDismiss}
      >
        {isMarkerSetEmpty(markers) ? (
          <MapMarkersEmpty
            isFiltered={controller.isFiltered}
            onClearFilters={controller.clearFilters}
          />
        ) : (
          <div className="flex flex-col gap-s5">
            <MapAttentionList items={markers.attention} zoneNameOf={zoneNameOf} />
            <MapProviderList providers={markers.providers} zoneNameOf={zoneNameOf} />
          </div>
        )}
      </Sheet>
    </>
  );
}
