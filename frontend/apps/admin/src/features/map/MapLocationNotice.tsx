import { MapPinOff } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import {
  MAP_LOCATION_STATES,
  isLocationFallback,
  type MapLocationController,
} from "./useMapLocation";

export interface MapLocationNoticeProps {
  location: MapLocationController;
  className?: string;
}

/**
 * Location permission denied or GPS unavailable → the map still works, centred on the primary
 * service city, with a NON-BLOCKING prompt (spec §6.7 edge cases). So this is an informational
 * banner the operator can dismiss, never a modal and never a gate: the map is opened because
 * something is already going wrong, and a permission dialog in front of it is a second problem.
 */
export function MapLocationNotice({ location, className }: MapLocationNoticeProps) {
  const { t } = useTranslation("adminMap");

  if (!isLocationFallback(location.state) || location.isNoticeDismissed) return null;

  return (
    <Banner
      tone="info"
      icon={MapPinOff}
      title={
        location.state === MAP_LOCATION_STATES.denied
          ? t("location.deniedTitle")
          : t("location.unavailableTitle")
      }
      detail={t("location.detail")}
      actions={
        <Button variant="text" size="inline" onClick={location.dismissNotice}>
          {t("location.dismiss")}
        </Button>
      }
      {...(className ? { className } : {})}
    />
  );
}
