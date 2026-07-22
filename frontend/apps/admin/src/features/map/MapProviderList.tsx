import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Card, CardList } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { StatusDot, type DotTone } from "../../components/ui/StatusDot";
import { formatRelative } from "../../lib/format";
import { ROUTES } from "../../routes/routes.constants";
import { PROVIDER_STATUS_KEYS } from "./map.labels";
import { PROVIDER_MAP_STATUSES, type MapProvider, type ProviderMapStatus } from "./map.types";

const STATUS_TONES: Readonly<Record<ProviderMapStatus, DotTone>> = {
  online: "success",
  busy: "info",
  offline: "neutral",
};

export interface MapProviderListProps {
  providers: readonly MapProvider[];
  zoneNameOf: (zoneId: string) => string;
}

/**
 * The markers, as a list. A purely visual map is not usable by everyone, so every pin the canvas
 * draws is also a keyboard-reachable row here — same set, same order, from the same selector
 * (ENGINEERING-STANDARDS Part 11; spec §6.7).
 */
export function MapProviderList({ providers, zoneNameOf }: MapProviderListProps) {
  const { t } = useTranslation("adminMap");

  return (
    <section className="flex flex-col gap-s2">
      <h3 className="text-pill uppercase text-text-2">
        {t("providers.heading", { count: providers.length })}
      </h3>

      {providers.length === 0 ? (
        <p className="text-caption text-text-2">{t("providers.hiddenByLayers")}</p>
      ) : (
        <CardList>
          {providers.map((provider) => (
            <Link key={provider.id} to={ROUTES.providerDetail(provider.id)} className="block">
              <Card density="tight">
                <span className="flex items-center gap-s2">
                  <StatusDot
                    tone={STATUS_TONES[provider.status]}
                    fill={provider.status === PROVIDER_MAP_STATUSES.offline ? "hollow" : "solid"}
                    label={t(PROVIDER_STATUS_KEYS[provider.status])}
                  />
                  <span className="grow min-w-0 flex flex-col">
                    <span className="text-label text-text-1 truncate">{provider.name}</span>
                    <span className="text-caption text-text-3 truncate">
                      {secondaryLine(provider)}
                    </span>
                  </span>
                  <Icon glyph={ChevronRight} className="text-text-3" />
                </span>
              </Card>
            </Link>
          ))}
        </CardList>
      )}
    </section>
  );

  function secondaryLine(provider: MapProvider): string {
    const zone = zoneNameOf(provider.zoneId);
    const status = t(PROVIDER_STATUS_KEYS[provider.status]);

    if (provider.status === PROVIDER_MAP_STATUSES.offline) {
      return `${zone} · ${status} · ${t("providers.lastSeen", {
        age: formatRelative(provider.locatedAt),
      })}`;
    }
    if (provider.onBookingRef) {
      return `${zone} · ${t("providers.onJob", { ref: `#${provider.onBookingRef}` })}`;
    }
    return `${zone} · ${status}`;
  }
}
