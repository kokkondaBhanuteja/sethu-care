import { Inbox } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Badge } from "../../components/ui/Badge";
import { CardList } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Segmented } from "../../components/ui/Segmented";
import { SkeletonList } from "../../components/ui/Skeleton";
import { MobileAppBar } from "../../layouts/MobileAppBar";
import { ApplicationCard } from "./components/ApplicationCard";
import { MobileScroll } from "../../layouts/PageMain";
import { useApplicationsQueue } from "./hooks/useApplicationsQueue";

/** M69 / M70. Oldest first, against the 48-hour decision target. */
export function ApplicationsQueueMobile() {
  const { t } = useTranslation("adminProviders");
  const queue = useApplicationsQueue(false);
  const pendingCount = queue.query.data?.counts.pending ?? 0;

  return (
    <>
      <MobileAppBar
        title={t("applications.title")}
        showBack
        compact
        bordered
        actions={
          <Badge count={pendingCount} tone="brand" label={t("roster.applicationsCountLabel")} />
        }
      />

      <MobileScroll>
        <div className="px-s4 pt-s3">
          <Segmented
            label={t("applications.segmentsLabel")}
            value={queue.segment}
            onValueChange={queue.setSegment}
            options={queue.segmentItems.map((item) => ({
              value: item.value,
              label: `${item.label} ${item.count ?? 0}`,
            }))}
          />
        </div>

        <p className="px-s4 pt-s3 text-caption text-text-3">{t("applications.sortNote")}</p>

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
            <SkeletonList rows={3} rowClassName="h-row-72" label={t("applications.loadingLabel")} />
          }
        >
          {(data) => (
            <div className="px-s4 pt-s3">
              <CardList>
                {data.rows.map((row) => (
                  <ApplicationCard key={row.id} row={row} />
                ))}
              </CardList>
            </div>
          )}
        </QueryBoundary>

        <div aria-hidden className="h-s4" />
      </MobileScroll>
    </>
  );
}
