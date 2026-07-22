import { useCallback, useState } from "react";
import { useNavigate } from "react-router";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { ROUTES } from "../../routes/routes.constants";
import { MAP_SHEETS, type MapSheet } from "./map.constants";
import { zeroSupplyZoneNames, zoneNameOf } from "./map.selectors";
import { MapLocationNotice } from "./MapLocationNotice";
import { MapMobileHeader } from "./MapMobileHeader";
import { MapPeekPanel } from "./MapPeekPanel";
import { MapSheets } from "./MapSheets";
import { MapSkeleton } from "./MapSkeleton";
import { MapSurface } from "./MapSurface";
import { MapZeroSupplyBanner } from "./MapZeroSupplyBanner";
import { useLiveMap } from "./useLiveMap";
import type { LiveMapSnapshot } from "./map.types";

/** BOX 41/42. Full-bleed canvas, floating controls, and a peek that never covers the city. */
export function LiveMapMobile() {
  const controller = useLiveMap();
  const navigate = useNavigate();
  const [openSheet, setOpenSheet] = useState<MapSheet>(MAP_SHEETS.none);

  const closeSheet = useCallback(() => setOpenSheet(MAP_SHEETS.none), []);
  const goBack = useCallback(() => void navigate(ROUTES.live), [navigate]);

  return (
    <QueryBoundary query={controller.query} skeleton={<MapSkeleton surface="mobile" />} grow>
      {(snapshot: LiveMapSnapshot) => {
        const nameOfZone = (zoneId: string) => zoneNameOf(snapshot, zoneId);
        const focusedZoneName = controller.focusedZoneId
          ? nameOfZone(controller.focusedZoneId)
          : null;

        return (
          <div className="grow min-h-0 relative">
            <MapSurface
              surface="mobile"
              viewport={controller.viewport}
              markers={controller.markers}
              zones={snapshot.zones}
              zoneNameOf={nameOfZone}
              showServiceAreas={controller.layers.serviceAreas}
              showDemandHeatmap={controller.layers.demandHeatmap}
              onSelectProvider={(provider) => void navigate(ROUTES.providerDetail(provider.id))}
              onSelectJob={(job) => void navigate(ROUTES.bookingDetail(job.bookingRef))}
              onSelectCluster={controller.focusCluster}
            />

            <MapMobileHeader
              onBack={goBack}
              onOpenLayers={() => setOpenSheet(MAP_SHEETS.layers)}
              onRecentre={controller.recentre}
            />

            {/* Pinned under the header, where it cannot be scrolled away or dismissed (BOX 42). */}
            <div className="absolute inset-x-0 top-row-56 z-10 flex flex-col">
              <MapZeroSupplyBanner zoneNames={zeroSupplyZoneNames(snapshot)} />
              <MapLocationNotice location={controller.location} />
            </div>

            <MapPeekPanel
              controller={controller}
              snapshot={snapshot}
              focusedZoneName={focusedZoneName}
              zoneNameOf={nameOfZone}
              onOpenOperations={() => setOpenSheet(MAP_SHEETS.operations)}
            />

            <MapSheets
              openSheet={openSheet}
              onDismiss={closeSheet}
              controller={controller}
              zoneNameOf={nameOfZone}
            />
          </div>
        );
      }}
    </QueryBoundary>
  );
}
