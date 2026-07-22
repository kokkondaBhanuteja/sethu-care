import { Image, Phone } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { formatTime } from "../../lib/format";
import { EvidenceCard } from "./EvidenceCard";
import type { ManualCompletionContext } from "./booking-actions.types";
import type { EvidenceGaps } from "./manualCompletionGates";

export interface ManualCompletionEvidenceStepProps {
  context: ManualCompletionContext;
  gaps: EvidenceGaps;
  onLogCallAttempt: () => void;
}

/**
 * Step 2. The call-attempt log is machine-written, not typed by the admin: evidence an admin can
 * author is not evidence, which is why the only control here dials the customer rather than
 * recording that someone did.
 *
 * The three cards stack on every shell: side by side they compressed to ~260px each inside the
 * modal, truncating mid-word and pushing the third card past the edge.
 */
export function ManualCompletionEvidenceStep({
  context,
  gaps,
  onLogCallAttempt,
}: ManualCompletionEvidenceStepProps) {
  const { t } = useTranslation("adminBookingActions");
  const { evidence } = context;

  return (
    <div className="flex flex-col gap-s4">
      <div>
        <h2 className="text-section text-text-1">{t("manual.evidenceTitle")}</h2>
        <p className="text-label text-text-2">{t("manual.evidenceSubtitle")}</p>
      </div>

      <div className="flex flex-col gap-s3">
        <EvidenceCard
          title={t("manual.evidencePhotos")}
          detail={
            gaps.needsPhotos
              ? t("manual.evidencePhotosMissing")
              : t("manual.evidencePhotosCount", { count: evidence.workPhotoIds.length })
          }
          isSatisfied={!gaps.needsPhotos}
        >
          <ul className="flex flex-wrap gap-s2">
            {evidence.workPhotoIds.map((photoId, index) => (
              <li
                key={photoId}
                className="flex h-row-56 w-row-56 items-center justify-center rounded-card bg-inset"
                role="img"
                aria-label={t("manual.workPhotoAlt", { index: index + 1 })}
              >
                <Icon glyph={Image} size="xl" className="text-text-3" />
              </li>
            ))}
          </ul>
        </EvidenceCard>

        <EvidenceCard
          title={t("manual.evidenceReport")}
          detail={
            gaps.needsReport
              ? t("manual.evidenceReportMissing")
              : t("manual.evidenceReportAt", {
                  time: formatTime(evidence.completionReportAtIso ?? ""),
                })
          }
          isSatisfied={!gaps.needsReport}
        />

        <EvidenceCard
          title={t("manual.evidenceCalls")}
          detail={
            gaps.needsCallAttempt
              ? t("manual.evidenceCallsMissing")
              : t("manual.evidenceCallsCount", { count: evidence.callAttempts.length })
          }
          isSatisfied={!gaps.needsCallAttempt}
          action={
            <Button
              variant={gaps.needsCallAttempt ? "primary" : "outline"}
              size="inline"
              iconStart={Phone}
              onClick={onLogCallAttempt}
            >
              {gaps.needsCallAttempt ? t("manual.callCustomer") : t("manual.callAgain")}
            </Button>
          }
        >
          <ul className="flex flex-col gap-s1">
            {evidence.callAttempts.map((attempt) => (
              <li key={attempt.id} className="text-label text-text-2">
                {t("manual.callAttemptLine", {
                  time: formatTime(attempt.atIso),
                  outcome: attempt.outcome,
                  seconds: attempt.durationSeconds,
                })}
              </li>
            ))}
          </ul>
        </EvidenceCard>
      </div>

      <p className="text-caption text-text-3">{t("manual.evidenceFootnote")}</p>
    </div>
  );
}
