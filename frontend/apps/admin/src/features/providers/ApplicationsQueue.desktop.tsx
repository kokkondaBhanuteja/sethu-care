import { Inbox } from "lucide-react";
import { useTranslation } from "@sethu/i18n";
import { PageHeader } from "@sethu/ui-web";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { EmptyState } from "../../components/ui/EmptyState";
import { Segmented } from "../../components/ui/Segmented";
import { SkeletonList } from "../../components/ui/Skeleton";
import { Topbar } from "../../layouts/Topbar";
import { ROUTES } from "../../routes/routes.constants";
import { ApplicationsTable } from "./components/ApplicationsTable.desktop";
import { PageMain } from "../../layouts/PageMain";
import { useApplicationsQueue } from "./hooks/useApplicationsQueue";

/**
 * BOX 43 / 44 in the approved page language: PageHeader with the SLA line, segmented queue tabs,
 * and the ageing-aware table in a white Card. The SLA line names the worst case, not the
 * average: "oldest 4 days" against a 48-hour target is the only number that requires a decision
 * today.
 */
export function ApplicationsQueueDesktop() {
  const { t } = useTranslation("adminProviders");
  const queue = useApplicationsQueue(true);
  const counts = queue.query.data?.counts;

  return (
    <>
      <Topbar
        pageRendersHeading
        crumbs={[
          { label: t("profile.breadcrumb"), to: ROUTES.providers },
          { label: t("applications.breadcrumb") },
        ]}
      />

      <PageMain>
        <PageHeader
          title={t("applications.title")}
          description={
            counts && counts.pending > 0
              ? t("applications.slaLine", {
                  count: counts.pending,
                  oldest: t("applications.slaOldest", {
                    count: queue.query.data?.oldestDays ?? 0,
                  }),
                })
              : undefined
          }
        />

        <Segmented
          label={t("applications.segmentsLabel")}
          value={queue.segment}
          onValueChange={queue.setSegment}
          options={queue.segmentItems.map((item) => ({
            value: item.value,
            label: `${item.label} ${item.count ?? 0}`,
          }))}
          className="self-start"
        />

        <QueryBoundary
          query={queue.query}
          isEmpty={(data) => data.rows.length === 0}
          empty={
            <EmptyState
              icon={Inbox}
              title={t("applications.emptyTitle")}
              body={t("applications.emptyBody")}
            />
          }
          skeleton={
            <SkeletonList rows={6} rowClassName="h-row-56" label={t("applications.loadingLabel")} />
          }
        >
          {(data) => <ApplicationsTable rows={data.rows} />}
        </QueryBoundary>
      </PageMain>
    </>
  );
}
