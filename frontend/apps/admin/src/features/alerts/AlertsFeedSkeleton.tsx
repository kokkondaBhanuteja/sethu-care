import { useTranslation } from "@sethu/i18n";

import { Skeleton, SkeletonList } from "../../components/ui/Skeleton";

/**
 * Shaped like the feed that is arriving — two tall needs-action cards over a run of 48px rows — so
 * nothing jumps when the data lands. The design forbids a spinner for content load (spec §4.10).
 */
export function AlertsFeedSkeleton() {
  const { t } = useTranslation("adminAlerts");

  return (
    <div role="status" aria-busy aria-label={t("loadingFeed")}>
      <Skeleton shape="pill" className="w-s8" />
      <div className="mt-s2 flex flex-col gap-s3">
        <Skeleton className="h-row-72 w-full rounded-card" />
        <Skeleton className="h-row-72 w-full rounded-card" />
      </div>
      <Skeleton shape="pill" className="mt-s5 w-s8" />
      <div className="mt-s2">
        <SkeletonList rows={5} rowClassName="h-row-48" label={t("loadingFeed")} />
      </div>
    </div>
  );
}
