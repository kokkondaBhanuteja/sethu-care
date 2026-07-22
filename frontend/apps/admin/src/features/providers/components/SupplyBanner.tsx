import { AlertTriangle } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";
import { CardContent, CardHeader, IconChip } from "@sethu/ui-web";

import { Card } from "../../../components/ui/Card";
import { Icon } from "../../../components/ui/Icon";
import { ROUTES } from "../../../routes/routes.constants";
import type { ZoneSupply } from "../providers.types";

export interface SupplyBannerProps {
  shortfall: ZoneSupply;
}

/**
 * Supply is the constraint this product lives or dies by, so the shortfall is a tinted warning
 * Card above the roster rather than a chip in the toolbar.
 *
 * There is deliberately no healthy counterpart: a permanent "supply is fine" band would train the
 * eye to skip exactly the place the warning appears (BOX 21 / M35). Callers render nothing when
 * `shortfall` is null.
 */
export function SupplyBannerDesktop({ shortfall }: SupplyBannerProps) {
  const { t } = useTranslation("adminProviders");

  return (
    <Card tone="warning" edge="warning" density="flush" role="status">
      <CardHeader
        icon={
          <IconChip accent="amber" look="soft">
            <AlertTriangle aria-hidden />
          </IconChip>
        }
        actions={
          <Link className="text-sm font-medium text-link underline" to={ROUTES.liveMap}>
            {t("roster.supplyViewZone")}
          </Link>
        }
        className="pb-1 sm:pb-1"
      >
        <span className="text-warning-fg">
          {t("roster.supplyLowTitle", { zone: shortfall.zone })}
        </span>
      </CardHeader>
      <CardContent className="text-sm text-ink">
        {t("roster.supplyLowDetail", {
          online: shortfall.onlineCount,
          threshold: shortfall.threshold,
        })}
      </CardContent>
    </Card>
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
