import { useState } from "react";
import { ScrollText, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Drawer } from "../../components/ui/Drawer";
import { EmptyState } from "../../components/ui/EmptyState";
import { FilterBar } from "../../components/ui/FilterBar";
import { Pagination } from "../../components/ui/Pagination";
import { Panel } from "../../components/ui/Panel";
import { SearchInput } from "../../components/ui/SearchInput";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Topbar } from "../../layouts/Topbar";
import { AuditAppliedFilters } from "./AuditAppliedFilters";
import { AuditDetailPanel } from "./AuditDetailPanel";
import { AuditFilterFields } from "./AuditFilterFields";
import { AuditImmutabilityStrip } from "./AuditImmutabilityStrip";
import { AuditLogTable } from "./AuditLogTable";
import { AuditTableSkeleton } from "./AuditSkeletons";
import { useAuditLog } from "./useAuditLog";
import { useAuditSelection } from "./useAuditEntry";

/**
 * Master–detail rather than an expanding row: an ops manager cross-checking a disputed action needs
 * the row's neighbours — who else touched this booking, in what order — visible while reading the
 * full entry (BOX 48). The detail sits beside the ledger, not over it.
 */
export function AuditLogScreenDesktop() {
  const { t } = useTranslation("adminAudit");
  const [isFilterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const log = useAuditLog();
  const { selectedId, select } = useAuditSelection();

  return (
    <>
      <Topbar title={t("title")} />
      <AuditImmutabilityStrip variant="desktop" />

      <main className="main">
        <FilterBar label={t("filters.label")} chips={[]} onToggle={() => undefined}>
          <SearchInput
            value={log.searchTerm}
            onValueChange={log.setSearchTerm}
            placeholder={t("search.placeholder")}
            label={t("search.label")}
          />
          <AuditFilterFields
            filters={log.filters}
            admins={log.admins}
            onChange={log.patchFilters}
            layout="inline"
          />
          <Button
            variant="text"
            size="inline"
            iconStart={SlidersHorizontal}
            onClick={() => setFilterDrawerOpen(true)}
          >
            {t("filters.more")}
          </Button>
          <Button variant="textBrand" size="inline" onClick={log.clearFilters}>
            {t("filters.clear")}
          </Button>
        </FilterBar>

        <AuditAppliedFilters
          filters={log.filters}
          admins={log.admins}
          page={log.query.data}
          onChange={log.patchFilters}
        />

        <div className="grid gap-s6 lg:grid-cols-12 mt-s4">
          <div className="lg:col-span-7">
            <Panel>
              <QueryBoundary
                query={log.query}
                skeleton={<AuditTableSkeleton />}
                isEmpty={(page) => page.items.length === 0}
                empty={
                  <EmptyState
                    icon={ScrollText}
                    title={t("state.emptyTitle")}
                    body={t("state.emptyBody")}
                  />
                }
                isFiltered={log.isFiltered}
                onClearFilters={log.clearFilters}
              >
                {(page) => (
                  <>
                    <AuditLogTable entries={page.items} onSelect={select} />
                    <Pagination
                      shown={page.items.length}
                      total={page.total}
                      subject={t("state.subject")}
                      onLoadMore={log.hasMore ? log.loadMore : undefined}
                      isLoadingMore={log.isLoadingMore}
                    />
                  </>
                )}
              </QueryBoundary>
            </Panel>
          </div>

          <div className="lg:col-span-5">
            <Card>
              <AuditDetailPanel entryId={selectedId} onOpenEntry={select} twoColumn />
            </Card>
          </div>
        </div>
      </main>

      <Drawer
        isOpen={isFilterDrawerOpen}
        title={t("filters.title")}
        width="narrow"
        onDismiss={() => setFilterDrawerOpen(false)}
        footer={
          <Button variant="outline" size="secondary" block onClick={log.clearFilters}>
            {t("filters.clear")}
          </Button>
        }
      >
        <AuditFilterFields filters={log.filters} admins={log.admins} onChange={log.patchFilters} />
      </Drawer>
    </>
  );
}
