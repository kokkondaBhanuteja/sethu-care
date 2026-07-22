import { FileSearch } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { EmptyState } from "../../components/ui/EmptyState";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { AuditDetailSkeleton } from "./AuditSkeletons";
import { AuditEntryDetail } from "./AuditEntryDetail";
import { useAuditEntry } from "./useAuditEntry";

export interface AuditDetailPanelProps {
  entryId: string | null;
  onOpenEntry: (entryId: string) => void;
  twoColumn?: boolean;
}

/** The detail half of the desktop master–detail. Loads its own record, so a deep link works. */
export function AuditDetailPanel({
  entryId,
  onOpenEntry,
  twoColumn = false,
}: AuditDetailPanelProps) {
  const { t } = useTranslation("adminAudit");
  const query = useAuditEntry(entryId);

  if (!entryId) {
    return <EmptyState icon={FileSearch} title={t("detail.emptyTitle")} body={t("detail.empty")} />;
  }

  return (
    <QueryBoundary query={query} skeleton={<AuditDetailSkeleton />}>
      {(entry) => (
        <AuditEntryDetail
          entry={entry}
          twoColumn={twoColumn}
          showHeading
          onOpenEntry={onOpenEntry}
        />
      )}
    </QueryBoundary>
  );
}
