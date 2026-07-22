import { Link } from "react-router";
import { Activity, RefreshCw, TriangleAlert, WifiOff } from "lucide-react";
import { useTranslation } from "@sethu/i18n";
import { Button as IconButton, buttonVariants } from "@sethu/ui-web";

import { Banner } from "../../components/ui/Banner";
import { Segmented } from "../../components/ui/Segmented";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { PageMain } from "../../layouts/PageMain";
import { Topbar } from "../../layouts/Topbar";
import { formatTime } from "../../lib/format";
import { ROUTES } from "../../routes/routes.constants";
import { ActivityTicker } from "./ActivityTicker";
import { AlertBand } from "./AlertBand";
import { AttentionAllClear } from "./AttentionEmptyStates";
import { ConnectionPill } from "./ConnectionPill";
import { DashboardSectionCard } from "./DashboardSectionCard";
import { ActivitySkeleton, AttentionSkeleton, KpiSkeleton } from "./DashboardSkeletons";
import { KpiTiles } from "./KpiTiles";
import { NeedsAttentionTable } from "./NeedsAttentionTable.desktop";
import { DASHBOARD_ATTENTION_LIMIT_DESKTOP } from "./dashboard.constants";
import { DASHBOARD_PERIODS } from "./dashboard.types";
import { CONNECTION_STATUSES } from "./useConnectionStatus";
import { useLiveDashboard } from "./useLiveDashboard";
import { useNeedsAttention } from "./useNeedsAttention";

const DESKTOP_ACTIVITY_LIMIT = 8;

/**
 * BOX 2 — the desktop dashboard in the premium language: period switch + connection pill as page
 * actions in the topbar (the screen's one header), then the PageShell rhythm inside PageMain —
 * alert card, KPI strip, queue card and ticker card.
 */
export function LiveDashboardDesktop() {
  const { t } = useTranslation("adminDashboard");
  const dashboard = useLiveDashboard({ activityLimit: DESKTOP_ACTIVITY_LIMIT });
  const attention = useNeedsAttention({
    limit: DASHBOARD_ATTENTION_LIMIT_DESKTOP,
    filterable: false,
  });
  const isOffline = dashboard.connection === CONNECTION_STATUSES.offline;
  const healthyJobs = attention.query.data?.healthyJobs ?? 0;

  return (
    <>
      <Topbar
        title={t("live.title")}
        actions={
          <>
            <Segmented
              label={t("period.label")}
              value={dashboard.period}
              onValueChange={dashboard.setPeriod}
              options={[
                { value: DASHBOARD_PERIODS.today, label: t("period.today") },
                { value: DASHBOARD_PERIODS.liveNow, label: t("period.liveNow") },
              ]}
            />
            <ConnectionPill status={dashboard.connection} />
          </>
        }
      />

      {/* Above everything because it qualifies all of it, alert counts included. It states the
          AGE of the data, not "no connection" — how far behind am I is the question. */}
      {isOffline && dashboard.dataAsOf ? (
        <Banner
          tone="warning"
          icon={WifiOff}
          sticky
          className="banner--wide"
          title={t("offline.banner", { time: formatTime(dashboard.dataAsOf) })}
        />
      ) : null}

      <PageMain>
        {dashboard.bandQuery.data ? (
          <AlertBand band={dashboard.bandQuery.data} variant="desktop" />
        ) : null}

        <QueryBoundary query={dashboard.summaryQuery} skeleton={<KpiSkeleton />}>
          {(summary) => <KpiTiles summary={summary} period={dashboard.period} />}
        </QueryBoundary>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
          <DashboardSectionCard
            className="xl:col-span-2"
            icon={TriangleAlert}
            accent="amber"
            title={t("attention.title")}
            flush
            actions={
              <>
                <Link
                  to={ROUTES.liveAttention}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {t("attention.seeAll")}
                </Link>
                <IconButton
                  variant="ghost"
                  size="icon"
                  aria-label={t("live.refresh")}
                  onClick={() => void attention.query.refetch()}
                >
                  <RefreshCw />
                </IconButton>
              </>
            }
          >
            <QueryBoundary
              query={attention.query}
              skeleton={
                <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                  <AttentionSkeleton rows={DASHBOARD_ATTENTION_LIMIT_DESKTOP} />
                </div>
              }
              isEmpty={(queue) => queue.items.length === 0}
              empty={
                <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                  <AttentionAllClear healthyJobs={healthyJobs} lastCleared={null} compact />
                </div>
              }
            >
              {(queue) => (
                <NeedsAttentionTable
                  items={queue.items}
                  permissions={attention.permissions}
                  isBlocked={attention.isActionBlocked}
                  acknowledgement={attention.acknowledgement}
                  variant="compact"
                />
              )}
            </QueryBoundary>
          </DashboardSectionCard>

          <DashboardSectionCard icon={Activity} accent="brand" title={t("activity.title")}>
            <QueryBoundary
              query={dashboard.activityQuery}
              skeleton={<ActivitySkeleton rows={DESKTOP_ACTIVITY_LIMIT} />}
            >
              {(entries) => <ActivityTicker entries={entries} />}
            </QueryBoundary>
          </DashboardSectionCard>
        </div>
      </PageMain>
    </>
  );
}
