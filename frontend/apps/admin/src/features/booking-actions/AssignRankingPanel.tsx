import { TriangleAlert } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { formatPercent } from "../../lib/format";
import type { DispatchRound, RankingWeight } from "./booking-actions.types";

export interface AssignRankingPanelProps {
  weights: readonly RankingWeight[];
  rounds: readonly DispatchRound[];
  declinedCount: number;
}

/**
 * The weights are shown, not hidden behind an "auto-assign" label: an ops manager overriding the
 * ranking needs to know what they are overriding, and the decline history is why this booking is in
 * front of them at all. It survives the no-candidates state for the same reason — "no providers" is
 * a claim, and this panel is the evidence for it.
 */
export function AssignRankingPanel({ weights, rounds, declinedCount }: AssignRankingPanelProps) {
  const { t } = useTranslation("adminBookingActions");

  return (
    <Card tone="surface">
      <p className="text-emph text-text-1">{t("assign.rankingTitle")}</p>

      <div className="mt-s2 flex flex-col gap-s2">
        {weights.map((weight) => (
          <div key={weight.factorId} className="flex items-center gap-s2">
            <span className="basis-2/5 shrink-0 text-caption text-text-2">
              {t(`assign.factor.${weight.factorId}`)}
            </span>
            <span className="h-s1 flex-1 overflow-hidden rounded-full bg-inset">
              <span
                className="block h-s1 rounded-full bg-brand"
                style={{ width: formatPercent(weight.weight) }}
              />
            </span>
            <span className="shrink-0 text-caption text-text-2">{formatPercent(weight.weight)}</span>
          </div>
        ))}
      </div>

      <p className="mt-s3 border-t border-border-subtle pt-s3 text-pill text-text-2">
        {t("assign.dispatchHistory")}
      </p>
      <ul className="mt-s2 flex flex-col gap-s1">
        {rounds.map((round) => (
          <li key={round.round} className="text-label text-text-2">
            {t("shared.roundSummary", {
              round: round.round,
              radius: round.radiusKm,
              declined: round.declined,
            })}
          </li>
        ))}
      </ul>

      <Card tone="warning" density="tight" className="mt-s3 flex items-start gap-s2">
        <Icon glyph={TriangleAlert} size="sm" className="text-warning" />
        <span className="text-caption text-warning">
          {t("assign.declinedWarning", { count: declinedCount })}
        </span>
      </Card>
    </Card>
  );
}
