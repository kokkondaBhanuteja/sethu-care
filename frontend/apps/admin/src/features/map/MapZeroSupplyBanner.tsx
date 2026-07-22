import { Link } from "react-router";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Banner } from "../../components/ui/Banner";
import { ROUTES } from "../../routes/routes.constants";

export interface MapZeroSupplyBannerProps {
  zoneNames: readonly string[];
  className?: string;
}

/**
 * Zero providers online in a zone is a business emergency, not a threshold being approached
 * (spec §6.7, BOX 25). It gets the danger tint rather than the roster's amber supply strip, it
 * names the consequence rather than the metric, and it is a Banner rather than an empty state
 * because the map behind it still has to work: the escalation it stranded is still on the canvas.
 */
export function MapZeroSupplyBanner({ zoneNames, className }: MapZeroSupplyBannerProps) {
  const { t } = useTranslation("adminMap");

  if (zoneNames.length === 0) return null;

  return (
    <Banner
      tone="danger"
      icon={AlertTriangle}
      title={t("zeroSupply.title", { zone: zoneNames.join(", ") })}
      detail={t("zeroSupply.detail")}
      actions={
        <Link className="text-label text-brand" to={ROUTES.providers}>
          {t("zeroSupply.action")}
        </Link>
      }
      {...(className ? { className } : {})}
    />
  );
}
