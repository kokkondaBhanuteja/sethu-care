import { Link } from "react-router";
import { Activity, MapPin, RefreshCw, TriangleAlert, WifiOff } from "lucide-react";
import { useTranslation } from "@sethu/i18n";
import { buttonVariants } from "@sethu/ui-web";

import { Banner } from "../../components/ui/Banner";
import { Icon } from "../../components/ui/Icon";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Segmented } from "../../components/ui/Segmented";
import { MobileAppBar } from "../../layouts/MobileAppBar";
import { MobileScroll } from "../../layouts/PageMain";
import { formatTime } from "../../lib/format";
import { ROUTES } from "../../routes/routes.constants";
import { ActivityTicker } from "./ActivityTicker";
import { AlertBand } from "./AlertBand";
import { AttentionAllClear } from "./AttentionEmptyStates";
import { ConnectionPill } from "./ConnectionPill";
import { DashboardSectionCard } from "./DashboardSectionCard";
import { ActivitySkeleton, AttentionSkeleton, KpiSkeleton } from "./DashboardSkeletons";
import { KpiTiles } from "./KpiTiles";
import { NeedsAttentionCards } from "./NeedsAttentionCards.mobile";
import { DASHBOARD_ATTENTION_LIMIT } from "./dashboard.constants";
import { DASHBOARD_PERIODS } from "./dashboard.types";
import { CONNECTION_STATUSES } from "./useConnectionStatus";
import { useLiveDashboard } from "./useLiveDashboard";
import { useNeedsAttention } from "./useNeedsAttention";

const MOBILE_ACTIVITY_LIMIT = 3;
const ATTENTION_CARD_SKELETON_HEIGHT = "h-row-72";

/**
 * BOX 2 — the app bar and the alert card sit OUTSIDE the scroll region as flex-none siblings, which
 * guarantees the card can never be scrolled away. That is the point of a non-dismissible band.
 * Below it, the same digestibility language as desktop: KPI grid, then the two section cards.
 */
export function LiveDashboardMobile() {
  const { t } = useTranslation("adminDashboard");
  const dashboard = useLiveDashboard({ activityLimit: MOBILE_ACTIVITY_LIMIT });
  const attention = useNeedsAttention({ limit: DASHBOARD_ATTENTION_LIMIT, filterable: false });
  const isOffline = dashboard.connection === CONNECTION_STATUSES.offline;

  return (
    <>
      <MobileAppBar
        title={t("live.title")}
        actions={
          <>
            <ConnectionPill status={dashboard.connection} />
            <Link to={ROUTES.liveMap} aria-label={t("live.openMap")}>
              <Icon glyph={MapPin} size="lg" />
            </Link>
            <button
              type="button"
              aria-label={t("live.refresh")}
              onClick={() => void dashboard.summaryQuery.refetch()}
            >
              <Icon glyph={RefreshCw} size="lg" />
            </button>
          </>
        }
      />

      {isOffline && dashboard.dataAsOf ? (
        <Banner
          tone="warning"
          icon={WifiOff}
          sticky
          title={t("offline.banner", { time: formatTime(dashboard.dataAsOf) })}
        />
      ) : null}

      {dashboard.bandQuery.data ? (
        <AlertBand band={dashboard.bandQuery.data} variant="mobile" className="mx-4 mt-3" />
      ) : null}

      <MobileScroll>
        <div className="flex flex-col gap-6 px-4 py-4">
          <Segmented
            label={t("period.label")}
            value={dashboard.period}
            onValueChange={dashboard.setPeriod}
            options={[
              { value: DASHBOARD_PERIODS.today, label: t("period.today") },
              { value: DASHBOARD_PERIODS.liveNow, label: t("period.liveNow") },
            ]}
          />

          <QueryBoundary query={dashboard.summaryQuery} skeleton={<KpiSkeleton />}>
            {(summary) => <KpiTiles summary={summary} period={dashboard.period} />}
          </QueryBoundary>

          <DashboardSectionCard
            icon={TriangleAlert}
            accent="amber"
            title={t("attention.title")}
            actions={
              <Link
                to={ROUTES.liveAttention}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {t("attention.seeAll")}
              </Link>
            }
          >
            <QueryBoundary
              query={attention.query}
              skeleton={
                <AttentionSkeleton
                  rows={DASHBOARD_ATTENTION_LIMIT}
                  rowHeight={ATTENTION_CARD_SKELETON_HEIGHT}
                />
              }
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
                <NeedsAttentionCards
                  items={queue.items}
                  permissions={attention.permissions}
                  isBlocked={attention.isActionBlocked}
                  acknowledgement={attention.acknowledgement}
                />
              )}
            </QueryBoundary>
          </DashboardSectionCard>

          <DashboardSectionCard icon={Activity} accent="brand" title={t("activity.title")}>
            <QueryBoundary
              query={dashboard.activityQuery}
              skeleton={<ActivitySkeleton rows={MOBILE_ACTIVITY_LIMIT} />}
            >
              {(entries) => <ActivityTicker entries={entries} />}
            </QueryBoundary>
          </DashboardSectionCard>
        </div>
      </MobileScroll>
    </>
  );
}
