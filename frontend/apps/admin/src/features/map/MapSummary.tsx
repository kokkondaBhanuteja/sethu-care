import { WifiOff, X } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Pill } from "../../components/ui/Pill";
import { formatDuration } from "../../lib/format";
import type { MapFreshness } from "./useMapStaleness";

export interface MapSummaryProps {
  activeJobCount: number;
  onlineProviderCount: number;
  freshness: MapFreshness;
  /** Set once a cluster or a zone has been focused, so the counts can say what is being shown. */
  focusedZoneName: string | null;
  onClearFocus: () => void;
  /** The dock carries the "Live operations" heading; the mobile peek leads with the counts. */
  heading?: string;
}

/**
 * The one line the design puts above everything else: "42 active · 18 providers online". Under poor
 * connectivity it gains a staleness chip, because the counts staying still is otherwise
 * indistinguishable from nothing happening (spec §6.7 edge cases).
 */
export function MapSummary({
  activeJobCount,
  onlineProviderCount,
  freshness,
  focusedZoneName,
  onClearFocus,
  heading,
}: MapSummaryProps) {
  const { t } = useTranslation("adminMap");

  return (
    <div className="flex flex-col gap-s2">
      {heading ? <h2 className="text-card text-text-1">{heading}</h2> : null}

      <div className="flex flex-wrap items-center gap-s2">
        <span className="text-emph text-text-1">
          {t("summary.counts", { jobs: activeJobCount, providers: onlineProviderCount })}
        </span>

        {freshness.isStale ? (
          <Pill
            tone="warning"
            striped
            icon={freshness.isOffline ? WifiOff : undefined}
            className="whitespace-nowrap"
          >
            {freshness.isOffline
              ? t("staleness.offline")
              : t("staleness.cached", { age: formatDuration(freshness.ageMs) })}
          </Pill>
        ) : null}
      </div>

      {freshness.isStale ? (
        <p className="text-caption text-text-2" role="status">
          {t("staleness.explain")}
        </p>
      ) : null}

      {focusedZoneName ? (
        <div className="flex items-center gap-s2">
          <Pill tone="info">{t("focus.showing", { zone: focusedZoneName })}</Pill>
          <Button variant="text" size="inline" iconStart={X} onClick={onClearFocus}>
            {t("focus.clear")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
