import { Download, ScrollText } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
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
import { auditCsvFilename, buildAuditCsv, downloadAuditCsv } from "./auditCsv";
import { useAuditLog } from "./useAuditLog";
import { useAuditSelection } from "./useAuditEntry";

/**
 * Master–detail rather than an expanding row: an ops manager cross-checking a disputed action needs
 * the row's neighbours — who else touched this booking, in what order — visible while reading the
 * full entry (BOX 48). The detail sits beside the ledger, not over it. The filter band carries the
 * complete filter set inline; there is no second filter surface to drift from it.
 */
export function AuditLogScreenDesktop() {
  const { t } = useTranslation("adminAudit");
  const log = useAuditLog();
  const { selectedId, select } = useAuditSelection();
  const loadedEntries = log.query.data?.items ?? [];

  // A copy of the filtered ledger as the screen shows it — a read, not a mutation; the log itself
  // stays append-only.
  const handleExportCsv = () => {
    if (loadedEntries.length === 0) return;
    const csv = buildAuditCsv(loadedEntries, {
      entryId: t("detail.entryId"),
      timestamp: t("detail.timestamp"),
      admin: t("columns.admin"),
      action: t("columns.action"),
      target: t("columns.target"),
      change: t("columns.change"),
      reason: t("columns.reason"),
    });
    downloadAuditCsv(csv, auditCsvFilename());
  };

  return (
    <>
      <Topbar
        title={t("title")}
        actions={
          <Button
            variant="outline"
            size="section"
            iconStart={Download}
            onClick={handleExportCsv}
            disabled={loadedEntries.length === 0}
          >
            {t("export.csv")}
          </Button>
        }
      />
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
                    <AuditLogTable
                      entries={page.items}
                      selectedEntryId={selectedId}
                      onSelect={select}
                    />
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
    </>
  );
}
