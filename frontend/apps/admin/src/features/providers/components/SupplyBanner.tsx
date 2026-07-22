import { AlertTriangle } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Banner } from "../../../components/ui/Banner";
import { Card } from "../../../components/ui/Card";
import { Icon } from "../../../components/ui/Icon";
import { ROUTES } from "../../../routes/routes.constants";
import type { ZoneSupply } from "../providers.types";

export interface SupplyBannerProps {
  shortfall: ZoneSupply;
}

/**
 * Supply is the constraint this product lives or dies by, so the shortfall is a full-bleed strip
 * above everything else rather than a chip in the toolbar.
 *
 * There is deliberately no healthy counterpart: a permanent "supply is fine" band would train the
 * eye to skip exactly the place the warning appears (BOX 21 / M35). Callers render nothing when
 * `shortfall` is null.
 */
export function SupplyBannerDesktop({ shortfall }: SupplyBannerProps) {
  const { t } = useTranslation("adminProviders");

  return (
    <Banner
      tone="warning"
      icon={AlertTriangle}
      title={t("roster.supplyLow", {
        zone: shortfall.zone,
        online: shortfall.onlineCount,
        threshold: shortfall.threshold,
      })}
      actions={
        <Link className="text-body text-brand underline" to={ROUTES.liveMap}>
          {t("roster.supplyViewZone")}
        </Link>
      }
    />
  );
}

export function SupplyCardMobile({ shortfall }: SupplyBannerProps) {
  const { t } = useTranslation("adminProviders");

  return (
    <Link to={ROUTES.liveMap} className="block">
      <Card tone="warning" edge="warning" density="tight">
        <div className="flex items-start gap-s2">
          <Icon glyph={AlertTriangle} className="text-warning" />
          <div className="grow">
            <span className="block text-label font-semibold text-warning">
              {t("roster.supplyLowTitle", { zone: shortfall.zone })}
            </span>
            <span className="mt-s1 block text-label text-text-1">
              {t("roster.supplyLowDetail", {
                online: shortfall.onlineCount,
                threshold: shortfall.threshold,
              })}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
