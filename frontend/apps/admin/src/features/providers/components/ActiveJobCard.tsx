import { CheckCircle2, Navigation, Play } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Icon } from "../../../components/ui/Icon";
import { Pill } from "../../../components/ui/Pill";
import { StatusDot } from "../../../components/ui/StatusDot";
import { formatMoney, formatTime } from "../../../lib/format";
import { ACTIVE_JOB_STAGES, JOB_RESOLUTIONS } from "../suspend.types";
import type { JobResolution, ProviderActiveJob } from "../suspend.types";

export interface ActiveJobCardProps {
  job: ProviderActiveJob;
  resolution: JobResolution | undefined;
  onResolve: (resolution: JobResolution | undefined) => void;
}

/**
 * One live booking that must be answered for before the suspension can proceed. The amber dot
 * marks the unresolved card; it sits beside an amber notice and two live buttons, so it never
 * carries meaning alone. Resolved swaps to a green tint, a check line and "Change".
 */
export function ActiveJobCard({ job, resolution, onResolve }: ActiveJobCardProps) {
  const { t } = useTranslation("adminProviders");
  const isEnRoute = job.stage === ACTIVE_JOB_STAGES.enRoute;
  const isResolved = resolution !== undefined;

  return (
    <Card tone={isResolved ? "tintSuccess" : "plain"} density="tight" className="relative">
      {!isResolved ? (
        <span className="absolute right-s3 top-s3">
          <StatusDot tone="warning" size="lg" label={t("suspend.jobUnresolved")} />
        </span>
      ) : null}

      <div className="flex items-center gap-s2">
        <Pill tone={isEnRoute ? "info" : "success"} icon={isEnRoute ? Navigation : Play}>
          {isEnRoute ? t("suspend.jobEnRoute") : t("suspend.jobInProgress")}
        </Pill>
        <span className="font-mono text-caption text-text-2">{job.bookingId}</span>
      </div>

      <p className="mt-s2 text-body text-text-1">
        {job.service} · {job.customerName} · {job.zone}
      </p>
      <p className="mt-s1 text-label text-text-2">
        {isEnRoute
          ? t("suspend.jobEta", {
              minutes: job.etaMinutes ?? 0,
              amount: formatMoney(job.amountPaise),
            })
          : t("suspend.jobStarted", {
              time: job.startedAt ? formatTime(job.startedAt) : "",
              amount: formatMoney(job.amountPaise),
            })}
      </p>

      {isResolved ? (
        <div className="mt-s3 flex items-center gap-s2">
          <Icon glyph={CheckCircle2} size="sm" className="text-success" />
          <span className="grow text-label text-success">
            {resolution === JOB_RESOLUTIONS.reassign
              ? t("suspend.jobResolvedReassign", { name: job.suggestedProviderName })
              : t("suspend.jobResolvedFinish")}
          </span>
          <Button variant="textBrand" size="inline" onClick={() => onResolve(undefined)}>
            {t("suspend.jobChange")}
          </Button>
        </div>
      ) : (
        <div className="mt-s3 flex gap-s2">
          <Button
            variant="primary"
            size="inline"
            block
            onClick={() => onResolve(JOB_RESOLUTIONS.reassign)}
          >
            {/* Named target: "Reassign" alone asks for a commitment without saying to whom. */}
            {t("suspend.jobReassign", { name: job.suggestedProviderName })}
          </Button>
          <Button
            variant="outline"
            size="inline"
            block
            onClick={() => onResolve(JOB_RESOLUTIONS.letFinish)}
          >
            {t("suspend.jobLetFinish")}
          </Button>
        </div>
      )}
    </Card>
  );
}
