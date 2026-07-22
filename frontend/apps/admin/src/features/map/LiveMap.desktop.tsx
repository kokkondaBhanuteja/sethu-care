import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Topbar } from "../../layouts/Topbar";
import { ROUTES } from "../../routes/routes.constants";
import { zeroSupplyZoneNames, zoneNameOf } from "./map.selectors";
import { MapDock } from "./MapDock";
import { MapLegend } from "./MapLegend";
import { MapLocationNotice } from "./MapLocationNotice";
import { MapSkeleton } from "./MapSkeleton";
import { MapSurface } from "./MapSurface";
import { MapZeroSupplyBanner } from "./MapZeroSupplyBanner";
import { useLiveMap } from "./useLiveMap";
import type { LiveMapSnapshot } from "./map.types";

/** BOX 24/25. The dock is docked, not floating: it must never cover the ground being inspected. */
export function LiveMapDesktop() {
  const { t } = useTranslation("adminMap");
  const controller = useLiveMap();
  const navigate = useNavigate();

  const openBooking = useCallback(
    (bookingRef: string) => void navigate(ROUTES.bookingDetail(bookingRef)),
    [navigate],
  );
  const openProvider = useCallback(
    (providerId: string) => void navigate(ROUTES.providerDetail(providerId)),
    [navigate],
  );

  return (
    <>
      <Topbar title={t("shortTitle")} />

      <QueryBoundary query={controller.query} skeleton={<MapSkeleton surface="desktop" />} grow>
        {(snapshot: LiveMapSnapshot) => {
          const nameOfZone = (zoneId: string) => zoneNameOf(snapshot, zoneId);
          const focusedZoneName = controller.focusedZoneId
            ? nameOfZone(controller.focusedZoneId)
            : null;

          return (
            <>
              <MapZeroSupplyBanner zoneNames={zeroSupplyZoneNames(snapshot)} />
              <MapLocationNotice location={controller.location} />

              <main className="flex-1 min-h-0 flex bg-canvas">
                <div className="map-wrap">
                  <MapSurface
                    surface="desktop"
                    viewport={controller.viewport}
                    markers={controller.markers}
                    zones={snapshot.zones}
                    zoneNameOf={nameOfZone}
                    showServiceAreas={controller.layers.serviceAreas}
                    showDemandHeatmap={controller.layers.demandHeatmap}
                    onSelectProvider={(provider) => openProvider(provider.id)}
                    onSelectJob={(job) => openBooking(job.bookingRef)}
                    onSelectCluster={controller.focusCluster}
                  >
                    <MapLegend />
                  </MapSurface>

                  <MapDock
                    controller={controller}
                    snapshot={snapshot}
                    focusedZoneName={focusedZoneName}
                    zoneNameOf={nameOfZone}
                  />
                </div>
              </main>
            </>
          );
        }}
      </QueryBoundary>
    </>
  );
}
