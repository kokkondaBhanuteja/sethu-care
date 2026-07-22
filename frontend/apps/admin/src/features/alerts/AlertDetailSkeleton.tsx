import { useTranslation } from "@sethu/i18n";

import { Skeleton } from "../../components/ui/Skeleton";

/** Shaped like the detail that is arriving: severity block, description, trigger card, record. */
export function AlertDetailSkeleton() {
  const { t } = useTranslation("adminAlerts");

  return (
    <div role="status" aria-busy aria-label={t("loadingAlert")} className="flex flex-col gap-s4">
      <Skeleton className="h-row-72 w-full rounded-card" />
      <Skeleton shape="text" className="w-full" />
      <Skeleton shape="text" className="w-full" />
      <Skeleton className="h-row-72 w-full rounded-card" />
      <Skeleton className="h-row-72 w-full rounded-card" />
    </div>
  );
}
