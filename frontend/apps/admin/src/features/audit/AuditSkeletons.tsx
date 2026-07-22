import { useTranslation } from "@sethu/i18n";

import { Skeleton, SkeletonList } from "../../components/ui/Skeleton";

/**
 * Skeletons match the shape of what is arriving, never a spinner — the layout must not jump when
 * the ledger lands (spec §4.10).
 */
export function AuditTableSkeleton() {
  const { t } = useTranslation("adminAudit");
  return <SkeletonList rows={10} rowClassName="h-row-48" label={t("state.loading")} />;
}

export function AuditListSkeleton() {
  const { t } = useTranslation("adminAudit");
  return (
    <div className="px-s4">
      <SkeletonList rows={6} rowClassName="h-row-72" label={t("state.loading")} />
    </div>
  );
}

export function AuditDetailSkeleton() {
  const { t } = useTranslation("adminAudit");
  return (
    <div className="flex flex-col gap-s3" role="status" aria-busy aria-label={t("state.loading")}>
      {DETAIL_ROWS.map((row) => (
        <div key={row} className="flex flex-col gap-s1">
          <Skeleton shape="text" className="w-1/3" />
          <Skeleton shape="text" className="w-2/3" />
        </div>
      ))}
    </div>
  );
}

const DETAIL_ROWS = ["entryId", "timestamp", "admin", "action", "target", "before", "after"];
