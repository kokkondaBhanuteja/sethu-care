import { ChevronRight, FileText } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Badge } from "../../../components/ui/Badge";
import { Icon } from "../../../components/ui/Icon";
import { ROUTES } from "../../../routes/routes.constants";

export interface ApplicationsEntryRowProps {
  pendingCount: number;
  oldestDays: number;
}

/**
 * Applications is an entry point, not a provider — so it is a bordered row set apart from the
 * roster list, carrying the age of the oldest waiting application against the 48-hour SLA.
 */
export function ApplicationsEntryRow({ pendingCount, oldestDays }: ApplicationsEntryRowProps) {
  const { t } = useTranslation("adminProviders");

  return (
    <Link
      to={ROUTES.applications}
      className="flex h-row-56 items-center gap-s3 rounded-card border border-border-subtle px-s3"
    >
      <Icon glyph={FileText} size="lg" className="text-text-2" />
      <span className="grow">
        <span className="block text-emph text-text-1">{t("roster.applications")}</span>
        <span className="block text-caption text-warning">
          {t("roster.applicationsOldest", { count: oldestDays })}
        </span>
      </span>
      <Badge count={pendingCount} tone="brand" label={t("roster.applicationsCountLabel")} />
      <Icon glyph={ChevronRight} className="text-text-3" />
    </Link>
  );
}
