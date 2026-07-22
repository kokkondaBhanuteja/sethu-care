import { Check, Star, Zap } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { Pill } from "../../components/ui/Pill";
import { formatPercent, formatTime } from "../../lib/format";
import { CandidateStatus } from "./CandidateStatus";
import type { ProviderCandidate } from "./booking-actions.types";

export interface AssignCandidateCardProps {
  candidate: ProviderCandidate;
  onSelect: (candidate: ProviderCandidate) => void;
  /** The row whose Assign button is in flight; every other button goes inert. */
  submittingProviderId: string | null;
  isSubmitting: boolean;
}

const BUTTON_VARIANTS = {
  available: "outlineBrand",
  onJob: "outlineWarning",
  declined: "outlineMuted",
} as const;

/**
 * One visual ladder, and the BUTTON colour carries it rather than the card fill: raised white =
 * assign freely; recessed + amber-outlined button = you are pulling a technician off a live job;
 * recessed + muted button = he already said no. The consequence is attached to the control the
 * operator presses, not to the card they read past.
 */
export function AssignCandidateCard({
  candidate,
  onSelect,
  submittingProviderId,
  isSubmitting,
}: AssignCandidateCardProps) {
  const { t } = useTranslation("adminBookingActions");
  const isRecessed = candidate.availability !== "available";
  const isThisRowSubmitting = submittingProviderId === candidate.providerId;

  return (
    <Card tone={isRecessed ? "surface" : "plain"}>
      {candidate.isBestMatch ? (
        <div className="mb-s2 flex justify-end">
          <Pill tone="info" icon={Zap}>
            {t("assign.bestMatch")}
          </Pill>
        </div>
      ) : null}

      <div className="flex items-center gap-s3">
        <Avatar name={candidate.name} size="lg" />
        <div className="flex min-w-0 flex-1 items-center gap-s2">
          <span className="truncate text-emph text-text-1">{candidate.name}</span>
          <span className="inline-flex shrink-0 items-center gap-s1 text-caption text-text-2">
            <Icon glyph={Star} size="sm" className="text-warning" />
            {candidate.rating}
          </span>
        </div>
        <CandidateStatus candidate={candidate} showFreeAt={false} />
      </div>

      <p className="mt-s2 flex items-center gap-s1 text-label text-text-2">
        <span>
          {t("assign.cardMetrics", {
            distance: candidate.distanceKm,
            eta: candidate.etaMinutes,
            skill: candidate.skillLabel ?? t("shared.none"),
          })}
        </span>
        {candidate.skillLabel ? <Icon glyph={Check} size="sm" className="text-success" /> : null}
      </p>

      <p className="mt-s1 text-caption text-text-3">
        {t("assign.cardLoad", {
          jobs: candidate.jobsToday,
          completion: formatPercent(candidate.completionRate),
        })}
      </p>

      <div className="mt-s3 flex items-center justify-between gap-s2">
        <span className={statusLineClass(candidate.availability)}>{statusLine(candidate, t)}</span>
        <Button
          variant={BUTTON_VARIANTS[candidate.availability]}
          size="inline"
          isLoading={isThisRowSubmitting}
          disabled={isSubmitting && !isThisRowSubmitting}
          onClick={() => onSelect(candidate)}
        >
          {t("assign.assign")}
        </Button>
      </div>
    </Card>
  );
}

function statusLineClass(availability: ProviderCandidate["availability"]): string {
  if (availability === "onJob") return "text-label text-warning";
  if (availability === "declined") return "text-label text-text-3";
  return "text-label text-success";
}

function statusLine(
  candidate: ProviderCandidate,
  translate: (key: string, values?: Record<string, unknown>) => string,
): string {
  if (candidate.availability === "onJob" && candidate.freeAtIso) {
    return translate("assign.onJobUntil", { time: formatTime(candidate.freeAtIso) });
  }
  if (candidate.availability === "declined") return "";
  return translate("assign.availableNow");
}
