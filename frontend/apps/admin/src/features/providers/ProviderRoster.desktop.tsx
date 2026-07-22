import { Filter, UserPlus, Users } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { SkeletonList } from "../../components/ui/Skeleton";
import { Tabs } from "../../components/ui/Tabs";
import { Topbar } from "../../layouts/Topbar";
import { ROUTES } from "../../routes/routes.constants";
import { DesktopMain } from "./components/PageBody";
import { RosterCountTags } from "./components/RosterCountTags";
import { RosterTable } from "./components/RosterTable.desktop";
import { SupplyBannerDesktop } from "./components/SupplyBanner";
import { useProviderRoster } from "./hooks/useProviderRoster";
import { useRosterSegmentItems } from "./hooks/useRosterSegmentItems";

/** BOX 20 / 21. Supply strip, segment tabs, roster table, and the count line that explains it. */
export function ProviderRosterDesktop() {
  const { t } = useTranslation("adminProviders");
  const navigate = useNavigate();
  const roster = useProviderRoster();
  const segmentItems = useRosterSegmentItems(roster.query.data?.counts);

  return (
    <>
      <Topbar title={t("roster.title")} />

      {roster.query.data?.shortfall ? (
        <SupplyBannerDesktop shortfall={roster.query.data.shortfall} />
      ) : null}

      <DesktopMain>
        <div className="flex items-center">
          <Tabs
            label={t("roster.segmentsLabel")}
            items={segmentItems}
            value={roster.segment}
            onValueChange={roster.setSegment}
            variant="flush"
            className="grow"
          />
          <Button variant="outline" size="inline" iconStart={Filter}>
            {t("roster.filter")}
          </Button>
          <Button
            variant="primary"
            size="inline"
            iconStart={UserPlus}
            className="ml-s2"
            onClick={() => void navigate(ROUTES.applications)}
          >
            {t("roster.applicationsWaiting", {
              count: roster.query.data?.pendingApplications ?? 0,
            })}
          </Button>
        </div>

        <QueryBoundary
          query={roster.query}
          isFiltered={roster.isFiltered}
          onClearFilters={roster.clearFilters}
          isEmpty={(data) => data.rows.length === 0}
          empty={
            <EmptyState
              icon={Users}
              title={t("roster.emptyTitle")}
              body={t("roster.emptyBody")}
            />
          }
          skeleton={
            <SkeletonList rows={8} rowClassName="h-row-56" label={t("roster.loadingLabel")} />
          }
        >
          {(data) => (
            <>
              <RosterCountTags counts={data.counts} />
              <RosterTable rows={data.rows} />
              <p className="px-s2 pt-s3 text-caption text-text-3">
                {t("roster.showing", { shown: data.rows.length, total: data.counts.total })} ·{" "}
                {data.shortfall
                  ? t("roster.supplyShortfall", {
                      zone: data.shortfall.zone,
                      online: data.shortfall.onlineCount,
                      threshold: data.shortfall.threshold,
                    })
                  : t("roster.supplyHealthy")}
              </p>
            </>
          )}
        </QueryBoundary>
      </DesktopMain>
    </>
  );
}
