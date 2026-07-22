import { ChevronUp } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { isMarkerSetEmpty } from "./map.selectors";
import { MapAttentionList } from "./MapAttentionList";
import { MapMarkersEmpty } from "./MapMarkersEmpty";
import { MapSummary } from "./MapSummary";
import type { LiveMapController } from "./useLiveMap";
import type { LiveMapSnapshot } from "./map.types";

export interface MapPeekPanelProps {
  controller: LiveMapController;
  snapshot: LiveMapSnapshot;
  focusedZoneName: string | null;
  zoneNameOf: (zoneId: string) => string;
  onOpenOperations: () => void;
}

/**
 * The peek the design leaves docked at the bottom of the map (BOX 41): the counts and the two
 * bookings that need a human, always visible. The full provider list is one press away in the
 * operations sheet rather than inline, because a sheet at full height covers the city.
 */
export function MapPeekPanel({
  controller,
  snapshot,
  focusedZoneName,
  zoneNameOf,
  onOpenOperations,
}: MapPeekPanelProps) {
  const { t } = useTranslation("adminMap");
  const { markers } = controller;

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-s3 rounded-t-sheet bg-canvas px-s4 pt-s3 pb-s3 shadow-sheet">
      <MapSummary
        activeJobCount={snapshot.activeJobCount}
        onlineProviderCount={snapshot.onlineProviderCount}
        freshness={controller.freshness}
        focusedZoneName={focusedZoneName}
        onClearFocus={controller.clearFilters}
      />

      {isMarkerSetEmpty(markers) ? (
        <MapMarkersEmpty
          isFiltered={controller.isFiltered}
          onClearFilters={controller.clearFilters}
        />
      ) : (
        <MapAttentionList items={markers.attention} zoneNameOf={zoneNameOf} />
      )}

      <Button
        variant="outline"
        size="secondary"
        block
        iconEnd={ChevronUp}
        onClick={onOpenOperations}
      >
        {t("providers.open")}
      </Button>
    </div>
  );
}
