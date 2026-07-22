import { useState } from "react";
import { Filter, ScrollText } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { FilterBar } from "../../components/ui/FilterBar";
import { Pagination } from "../../components/ui/Pagination";
import { Sheet } from "../../components/ui/Sheet";
import { SearchInput } from "../../components/ui/SearchInput";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { MobileAppBar } from "../../layouts/MobileAppBar";
import { AuditAppliedFilters } from "./AuditAppliedFilters";
import { AuditDayList } from "./AuditDayList";
import { AuditFilterFields } from "./AuditFilterFields";
import { AuditImmutabilityStrip } from "./AuditImmutabilityStrip";
import { AuditListSkeleton } from "./AuditSkeletons";
import { AUDIT_QUICK_FILTERS } from "./audit.constants";
import { useAuditLog } from "./useAuditLog";

export interface AuditLogScreenMobileProps {
  onSelect: (entryId: string) => void;
}

/** The mobile ledger (BOX 75/77/78). No edit, delete, export or swipe control anywhere. */
export function AuditLogScreenMobile({ onSelect }: AuditLogScreenMobileProps) {
  const { t } = useTranslation("adminAudit");
  const [isSheetOpen, setSheetOpen] = useState(false);
  const log = useAuditLog();

  const chips = AUDIT_QUICK_FILTERS.map((quick) => ({
    id: quick.id,
    label: t(quick.labelKey),
    isActive:
      log.filters.action === quick.patch.action &&
      log.filters.targetType === quick.patch.targetType,
  }));

  return (
    <>
      <MobileAppBar
        title={t("title")}
        showBack
        compact
        bordered
        actions={
          <Button
            variant="text"
            size="inline"
            iconStart={Filter}
            aria-label={t("filters.openFilters")}
            onClick={() => setSheetOpen(true)}
          />
        }
      />
      <AuditImmutabilityStrip variant="mobile" />

      <div className="screen__scroll">
        <div className="px-s4 pt-s3">
          <SearchInput
            value={log.searchTerm}
            onValueChange={log.setSearchTerm}
            placeholder={t("search.placeholder")}
            label={t("search.label")}
          />
        </div>

        <FilterBar
          label={t("filters.label")}
          chips={chips}
          onToggle={(id) => {
            const quick = AUDIT_QUICK_FILTERS.find((candidate) => candidate.id === id);
            if (quick) log.patchFilters(quick.patch);
          }}
          className="px-s4"
        />

        <div className="px-s4 pb-s2">
          <AuditAppliedFilters
            filters={log.filters}
            admins={log.admins}
            page={log.query.data}
            onChange={log.patchFilters}
          />
        </div>

        <QueryBoundary
          query={log.query}
          skeleton={<AuditListSkeleton />}
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
              <AuditDayList entries={page.items} onSelect={onSelect} />
              <div className="px-s4">
                <Pagination
                  shown={page.items.length}
                  total={page.total}
                  subject={t("state.subject")}
                  onLoadMore={log.hasMore ? log.loadMore : undefined}
                  isLoadingMore={log.isLoadingMore}
                />
              </div>
            </>
          )}
        </QueryBoundary>

        <p className="px-s4 py-s4 pb-s8 text-caption text-text-3 text-center">
          {t("state.retentionNote")}
        </p>
      </div>

      <Sheet
        isOpen={isSheetOpen}
        title={t("filters.title")}
        onDismiss={() => setSheetOpen(false)}
        footer={
          <Button variant="outline" size="primary" block onClick={log.clearFilters}>
            {t("filters.clear")}
          </Button>
        }
      >
        <AuditFilterFields filters={log.filters} admins={log.admins} onChange={log.patchFilters} />
      </Sheet>
    </>
  );
}
