import { UserPlus, Users } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "@sethu/i18n";
import { PageHeader } from "@sethu/ui-web";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Segmented } from "../../components/ui/Segmented";
import { SkeletonList } from "../../components/ui/Skeleton";
import { Topbar } from "../../layouts/Topbar";
import { ROUTES } from "../../routes/routes.constants";
import { PageMain } from "../../layouts/PageMain";
import { RosterCountTags } from "./components/RosterCountTags";
import { RosterFilterBand } from "./components/RosterFilterBand";
import { RosterTable } from "./components/RosterTable.desktop";
import { SupplyBannerDesktop } from "./components/SupplyBanner";
import { useProviderRoster } from "./hooks/useProviderRoster";
import { useRosterSegmentItems } from "./hooks/useRosterSegmentItems";

/**
 * BOX 20 / 21, in the approved page language: PageHeader, a labelled FilterBand, segmented
 * roster tabs, and the table in a white Card — with the supply shortfall as a tinted warning
 * Card above the roster whenever a zone trips its threshold.
 */
export function ProviderRosterDesktop() {
  const { t } = useTranslation("adminProviders");
  const navigate = useNavigate();
  const roster = useProviderRoster();
  const segmentItems = useRosterSegmentItems(roster.query.data?.counts);

  return (
    <>
      <Topbar crumbs={[{ label: t("roster.title") }]} pageRendersHeading />

      <PageMain>
        <PageHeader
          title={t("roster.title")}
          actions={
            <Button
              variant="primary"
              size="inline"
              iconStart={UserPlus}
              onClick={() => void navigate(ROUTES.applications)}
            >
              {t("roster.applicationsWaiting", {
                count: roster.query.data?.pendingApplications ?? 0,
              })}
            </Button>
          }
        />

        {roster.query.data?.shortfall ? (
          <SupplyBannerDesktop shortfall={roster.query.data.shortfall} />
        ) : null}

        <RosterFilterBand
          searchTerm={roster.searchTerm}
          onSearchTermChange={roster.setSearchTerm}
          refinements={roster.refinements}
          onRefinementsChange={roster.setRefinements}
          options={roster.filterOptions}
        />

        <Segmented
          label={t("roster.segmentsLabel")}
          value={roster.segment}
          onValueChange={roster.setSegment}
          options={segmentItems.map((item) => ({
            value: item.value,
            label: `${item.label} ${item.count ?? 0}`,
          }))}
          className="self-start"
        />

        <QueryBoundary
          query={roster.query}
          isFiltered={roster.isFiltered}
          onClearFilters={roster.clearFilters}
          isEmpty={() => roster.visibleRows.length === 0}
          empty={
            <EmptyState icon={Users} title={t("roster.emptyTitle")} body={t("roster.emptyBody")} />
          }
          skeleton={
            <SkeletonList rows={8} rowClassName="h-row-56" label={t("roster.loadingLabel")} />
          }
        >
          {(data) => (
            <div className="flex flex-col gap-3">
              <RosterCountTags counts={data.counts} />
              <RosterTable rows={roster.visibleRows} />
              <p className="text-sm text-faint">
                {t("roster.showing", {
                  shown: roster.visibleRows.length,
                  total: data.counts.total,
                })}{" "}
                ·{" "}
                {data.shortfall
                  ? t("roster.supplyShortfall", {
                      zone: data.shortfall.zone,
                      online: data.shortfall.onlineCount,
                      threshold: data.shortfall.threshold,
                    })
                  : t("roster.supplyHealthy")}
              </p>
            </div>
          )}
        </QueryBoundary>
      </PageMain>
    </>
  );
}
