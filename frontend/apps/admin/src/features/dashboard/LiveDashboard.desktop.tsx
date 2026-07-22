import { Link } from "react-router";
import { WifiOff } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Banner } from "../../components/ui/Banner";
import { Panel } from "../../components/ui/Panel";
import { Segmented } from "../../components/ui/Segmented";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Topbar } from "../../layouts/Topbar";
import { formatTime } from "../../lib/format";
import { ROUTES } from "../../routes/routes.constants";
import { ActivityTicker } from "./ActivityTicker";
import { AlertBand } from "./AlertBand";
import { AttentionAllClear } from "./AttentionEmptyStates";
import { ConnectionPill } from "./ConnectionPill";
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
 * BOX 2 — the screen that invents the desktop language: the full-bleed alert band, KPI tiles in a
 * single row, and the data table that replaces mobile's stacked cards.
 */
export function LiveDashboardDesktop() {
  const { t } = useTranslation("adminDashboard");
  const dashboard = useLiveDashboard({ activityLimit: DESKTOP_ACTIVITY_LIMIT });
  const attention = useNeedsAttention({
    limit: DASHBOARD_ATTENTION_LIMIT_DESKTOP,
    filterable: false,
  });
  const isOffline = dashboard.connection === CONNECTION_STATUSES.offline;

  return (
    <>
      <Topbar title={t("live.title")} actions={<ConnectionPill status={dashboard.connection} />} />

      {/* Above the alert band, because it qualifies everything below it — including the band's
          own counts. It states the AGE of the data rather than "no connection": what the reader
          needs to judge is how far behind they are, not the state of the socket. */}
      {isOffline && dashboard.dataAsOf ? (
        <Banner
          tone="warning"
          icon={WifiOff}
          sticky
          className="banner--wide"
          title={t("offline.banner", { time: formatTime(dashboard.dataAsOf) })}
        />
      ) : null}

      {dashboard.bandQuery.data ? (
        <AlertBand band={dashboard.bandQuery.data} variant="desktop" />
      ) : null}

      <main className="main">
        <div className="split split--65-35">
          <div className="stack">
            {/* A switch, not tabs: it re-queries the same content rather than changing section.
                Constrained rather than full-bleed — the closest token to the drawn 220px. */}
            <div className="w-sidebar">
              <Segmented
                label={t("period.label")}
                value={dashboard.period}
                onValueChange={dashboard.setPeriod}
                options={[
                  { value: DASHBOARD_PERIODS.today, label: t("period.today") },
                  { value: DASHBOARD_PERIODS.liveNow, label: t("period.liveNow") },
                ]}
              />
            </div>

            <QueryBoundary query={dashboard.summaryQuery} skeleton={<KpiSkeleton layout="row" />}>
              {(summary) => <KpiTiles summary={summary} layout="row" />}
            </QueryBoundary>

            <Panel
              title={t("attention.title")}
              headerActions={
                <Link to={ROUTES.liveAttention} className="text-brand text-label">
                  {t("attention.seeAll")}
                </Link>
              }
            >
              <QueryBoundary
                query={attention.query}
                skeleton={<AttentionSkeleton rows={DASHBOARD_ATTENTION_LIMIT_DESKTOP} />}
                isEmpty={(queue) => queue.items.length === 0}
                empty={
                  <AttentionAllClear
                    healthyJobs={attention.query.data?.healthyJobs ?? 0}
                    lastCleared={null}
                    compact
                  />
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
            </Panel>
          </div>

          <div className="stack">
            <Panel title={t("activity.title")} flush={false}>
              <QueryBoundary
                query={dashboard.activityQuery}
                skeleton={<ActivitySkeleton rows={DESKTOP_ACTIVITY_LIMIT} />}
              >
                {(entries) => <ActivityTicker entries={entries} />}
              </QueryBoundary>
            </Panel>
          </div>
        </div>
      </main>
    </>
  );
}
