import type { ReactNode } from "react";
import { useTranslation } from "@sethu/i18n";

import { cx } from "../../lib/cx";
import { ClusterGlyph, ProviderGlyph } from "./MapMarkerGlyph";
import { PROVIDER_MAP_STATUSES } from "./map.types";

const LEGEND_CLUSTER_SAMPLE = 12;

export interface MapLegendProps {
  /** Floating over the map's top-left corner (BOX 24). False renders it inline, inside a sheet. */
  floating?: boolean;
}

/**
 * What each silhouette means. The map is the one screen where a reader cannot infer the vocabulary
 * from context, so the key sits on the canvas rather than in a help page.
 */
export function MapLegend({ floating = true }: MapLegendProps) {
  const { t } = useTranslation("adminMap");

  return (
    <div className={cx(floating ? "map-legend" : "flex flex-col gap-s2")}>
      <h2 className="sr-only">{t("legend.heading")}</h2>

      <LegendRow
        swatch={
          <ProviderGlyph status={PROVIDER_MAP_STATUSES.online} statusLabel={t("status.online")} />
        }
      >
        {t("legend.providerOnline")}
      </LegendRow>
      <LegendRow
        swatch={
          <ProviderGlyph status={PROVIDER_MAP_STATUSES.busy} statusLabel={t("status.busy")} />
        }
      >
        {t("legend.providerBusy")}
      </LegendRow>
      <LegendRow
        swatch={
          <ProviderGlyph status={PROVIDER_MAP_STATUSES.offline} statusLabel={t("status.offline")} />
        }
      >
        {t("legend.providerOffline")}
      </LegendRow>
      <LegendRow swatch={<span className="map-marker__job" />}>{t("legend.job")}</LegendRow>
      <LegendRow swatch={<span className="map-marker__job map-marker__job--danger" />}>
        {t("legend.escalated")}
      </LegendRow>
      <LegendRow swatch={<ClusterGlyph count={LEGEND_CLUSTER_SAMPLE} />}>
        {t("legend.cluster")}
      </LegendRow>
    </div>
  );
}

/** The swatch is hidden from assistive tech: the row's own text already names what it shows. */
function LegendRow({ swatch, children }: { swatch: ReactNode; children: ReactNode }) {
  return (
    <div className="map-legend__row">
      <span className="contents" aria-hidden>
        {swatch}
      </span>
      {children}
    </div>
  );
}
