import { Filter, MapPin, Users, WifiOff } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Icon } from "../../components/ui/Icon";
import { SearchInput } from "../../components/ui/SearchInput";
import { SkeletonList } from "../../components/ui/Skeleton";
import { Tabs } from "../../components/ui/Tabs";
import { MobileAppBar } from "../../layouts/MobileAppBar";
import { formatDuration, formatTime } from "../../lib/format";
import { ROUTES } from "../../routes/routes.constants";
import { ApplicationsEntryRow } from "./components/ApplicationsEntryRow";
import { MobileScroll } from "./components/PageBody";
import { RosterCard } from "./components/RosterCard";
import { SupplyCardMobile } from "./components/SupplyBanner";
import { useProviderRoster } from "./hooks/useProviderRoster";
import { useRosterSegmentItems } from "./hooks/useRosterSegmentItems";

/** M34–M37. Search, the supply card, segment tabs, and the roster as stacked rows. */
export function ProviderRosterMobile() {
  const { t } = useTranslation("adminProviders");
  const navigate = useNavigate();
  const roster = useProviderRoster();
  const data = roster.query.data;
  const segmentItems = useRosterSegmentItems(data?.counts);

  return (
    <>
      <MobileAppBar
        title={t("roster.title")}
        actions={
          <>
            <Button variant="text" size="inline" aria-label={t("roster.filters")}>
              <Icon glyph={Filter} size="lg" className="text-text-2" />
            </Button>
            <Button
              variant="text"
              size="inline"
              aria-label={t("roster.showOnMap")}
              onClick={() => void navigate(ROUTES.liveMap)}
            >
              <Icon glyph={MapPin} size="lg" className="text-text-2" />
            </Button>
          </>
        }
      />

      {roster.isStale && data ? (
        <Banner
          tone="warning"
          icon={WifiOff}
          title={t("roster.offlineBanner", {
            time: formatTime(data.statusesAsOf),
            age: formatDuration(roster.statusAgeMs),
          })}
        />
      ) : null}

      <div className="px-s4 pb-s3 pt-s2">
        <SearchInput
          value={roster.searchTerm}
          onValueChange={roster.setSearchTerm}
          placeholder={t("roster.searchPlaceholder")}
          label={t("roster.searchLabel")}
        />
      </div>

      {data?.shortfall ? (
        <div className="px-s4 pb-s3">
          <SupplyCardMobile shortfall={data.shortfall} />
        </div>
      ) : null}

      <Tabs
        label={t("roster.segmentsLabel")}
        items={segmentItems}
        value={roster.segment}
        onValueChange={roster.setSegment}
        variant="fill"
      />

      <MobileScroll>
        {/* Kept above the list on purpose: a narrow filter must not conceal a zone running dry. */}
        <div className="px-s4 py-s3">
          <ApplicationsEntryRow
            pendingCount={data?.pendingApplications ?? 0}
            oldestDays={data?.oldestApplicationDays ?? 0}
          />
        </div>

        <QueryBoundary
          query={roster.query}
          isFiltered={roster.isFiltered}
          onClearFilters={roster.clearFilters}
          isEmpty={(rosterData) => rosterData.rows.length === 0}
          empty={
            <EmptyState icon={Users} title={t("roster.emptyTitle")} body={t("roster.emptyBody")} />
          }
          skeleton={
            <SkeletonList rows={5} rowClassName="h-row-72" label={t("roster.loadingLabel")} />
          }
        >
          {(loadedRoster) =>
            loadedRoster.rows.map((row) => (
              <RosterCard
                key={row.id}
                row={row}
                staleAgeMs={roster.isStale ? roster.statusAgeMs : null}
              />
            ))
          }
        </QueryBoundary>

        <div aria-hidden className="h-s4" />
      </MobileScroll>
    </>
  );
}
