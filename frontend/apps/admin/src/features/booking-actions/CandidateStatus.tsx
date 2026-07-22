import { CircleX } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Icon } from "../../components/ui/Icon";
import { StatusDot } from "../../components/ui/StatusDot";
import { formatTime } from "../../lib/format";
import type { ProviderCandidate } from "./booking-actions.types";

export interface CandidateStatusProps {
  candidate: ProviderCandidate;
  /** The table stacks the free-at line under the dot; the card puts it on its own row. */
  showFreeAt?: boolean;
}

/**
 * Live availability for one candidate. A decliner keeps their row — ops sometimes has to force an
 * assignment onto a provider who said no — but the refusal is stated with its time, so the operator
 * knows how stale it is.
 */
export function CandidateStatus({ candidate, showFreeAt = true }: CandidateStatusProps) {
  const { t } = useTranslation("adminBookingActions");

  if (candidate.availability === "declined") {
    return (
      <span className="flex items-start gap-s1">
        <Icon glyph={CircleX} size="sm" className="text-danger" />
        <span className="text-caption text-danger">
          {t("assign.declinedAt", { time: formatTime(candidate.declinedAtIso ?? "") })}
        </span>
      </span>
    );
  }

  if (candidate.availability === "onJob") {
    return (
      <span className="flex flex-col">
        <StatusDot tone="warning" fill="half" size="sm" label={t("assign.onJob")} visualLabel />
        {showFreeAt && candidate.freeAtIso ? (
          <span className="text-caption text-text-2">
            {t("assign.freeAt", { time: formatTime(candidate.freeAtIso) })}
          </span>
        ) : null}
      </span>
    );
  }

  return <StatusDot tone="success" size="sm" label={t("assign.available")} visualLabel />;
}
