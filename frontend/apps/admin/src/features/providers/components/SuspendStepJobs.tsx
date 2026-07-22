import { AlertTriangle } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../../components/states/QueryBoundary";
import { Banner } from "../../../components/ui/Banner";
import { SkeletonList } from "../../../components/ui/Skeleton";
import { cx } from "../../../lib/cx";
import type { useSuspendProviderFlow } from "../hooks/useSuspendProviderFlow";
import { ActiveJobCard } from "./ActiveJobCard";

export interface SuspendStepJobsProps {
  flow: ReturnType<typeof useSuspendProviderFlow>;
  /** Desktop resolves the jobs side by side; mobile stacks them. */
  layout: "row" | "stack";
}

/**
 * Step 3 — the step that stops an operator suspending someone mid-shift without noticing.
 *
 * Suspending a provider mid-job is invisible to the admin and catastrophic to the person waiting
 * at home, so every live booking must be explicitly handled before the flow can continue. Desktop
 * puts them side by side because the choice being made is a comparison: which of these customers
 * can wait.
 */
export function SuspendStepJobs({ flow, layout }: SuspendStepJobsProps) {
  const { t } = useTranslation("adminProviders");
  const providerName = flow.profile?.name ?? flow.providerId;

  return (
    <section>
      <h2 className="text-section text-text-1">{t("suspend.activeJobsTitle")}</h2>

      <QueryBoundary
        query={flow.activeJobsQuery}
        skeleton={
          <SkeletonList rows={2} rowClassName="h-row-72" label={t("suspend.loadingLabel")} />
        }
      >
        {(jobs) => (
          <>
            <Banner
              tone="warning"
              icon={AlertTriangle}
              className="mt-s3"
              title={t("suspend.activeJobsNotice", { name: providerName, count: jobs.length })}
            />

            <div
              className={cx("mt-s3 grid gap-s3", layout === "row" ? "grid-cols-2" : "grid-cols-1")}
            >
              {jobs.map((job) => (
                <ActiveJobCard
                  key={job.bookingId}
                  job={job}
                  resolution={flow.jobResolutions[job.bookingId]}
                  onResolve={(resolution) => flow.resolveJob(job.bookingId, resolution)}
                />
              ))}
            </div>
          </>
        )}
      </QueryBoundary>
    </section>
  );
}
