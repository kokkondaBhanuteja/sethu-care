import { ArrowRight, Ban, Clock, Flag, IndianRupee } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Card } from "../../../components/ui/Card";
import { Icon } from "../../../components/ui/Icon";
import { RadioGroup } from "../../../components/ui/form/RadioGroup";
import { JOB_RESOLUTIONS } from "../suspend.types";
import type { useSuspendProviderFlow } from "../hooks/useSuspendProviderFlow";

const NOTIFY_OPTIONS = { immediately: "immediately", afterJob: "afterJob" } as const;
type NotifyOption = (typeof NOTIFY_OPTIONS)[keyof typeof NOTIFY_OPTIONS];

export interface SuspendStepConfirmProps {
  flow: ReturnType<typeof useSuspendProviderFlow>;
}

/**
 * Step 4. The summary folds in what step 3 decided — where each live job went — so the operator
 * confirms the whole consequence, not just the suspension. The provider's message is shown
 * verbatim because they read exactly these words, with no context and no right of reply.
 */
export function SuspendStepConfirm({ flow }: SuspendStepConfirmProps) {
  const { t } = useTranslation("adminProviders");
  const providerName = flow.profile?.name ?? flow.providerId;

  return (
    <section className="flex flex-col gap-s4">
      <h2 className="text-section text-text-1">{t("suspend.confirmTitle")}</h2>

      <Card tone="surface">
        <SummaryLine icon={Ban} tone="text-danger" text={flow.messages.summaryHeadline} />
        <SummaryLine
          icon={Flag}
          text={t("suspend.summaryReason", { reason: flow.messages.reasonLabel })}
        />
        {flow.activeJobs.map((job) => {
          const resolution = flow.jobResolutions[job.bookingId];
          if (resolution === undefined) return null;
          return (
            <SummaryLine
              key={job.bookingId}
              icon={resolution === JOB_RESOLUTIONS.reassign ? ArrowRight : Clock}
              text={
                resolution === JOB_RESOLUTIONS.reassign
                  ? t("suspend.summaryReassigned", {
                      booking: job.bookingId,
                      name: job.suggestedProviderName,
                    })
                  : t("suspend.summaryCompletesFirst", { booking: job.bookingId })
              }
            />
          );
        })}
        <SummaryLine icon={IndianRupee} text={t("suspend.summaryPayouts")} />
      </Card>

      <RadioGroup
        legend={t("suspend.notifyLabel")}
        tone="danger"
        name="suspend-notify"
        value={flow.notifyImmediately ? NOTIFY_OPTIONS.immediately : NOTIFY_OPTIONS.afterJob}
        onValueChange={(value: NotifyOption) =>
          flow.setNotifyImmediately(value === NOTIFY_OPTIONS.immediately)
        }
        options={[
          { value: NOTIFY_OPTIONS.immediately, label: t("suspend.notifyImmediately") },
          { value: NOTIFY_OPTIONS.afterJob, label: t("suspend.notifyAfterJob") },
        ]}
      />

      <div>
        <p className="text-pill uppercase tracking-wide text-text-2">
          {t("suspend.messageLabel", { name: providerName })}
        </p>
        <Card tone="surface" density="tight" className="mt-s2">
          <p className="text-label text-text-1">{flow.messages.providerMessage}</p>
        </Card>
      </div>
    </section>
  );
}

function SummaryLine({
  icon,
  text,
  tone = "text-text-2",
}: {
  icon: LucideIcon;
  text: string;
  tone?: string;
}) {
  return (
    <div className="mt-s3 flex items-start gap-s2 first:mt-0">
      <Icon glyph={icon} className={tone} />
      <span className="text-label text-text-1">{text}</span>
    </div>
  );
}
