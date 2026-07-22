import { Check, Star } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { Icon } from "../../components/ui/Icon";
import { Pill } from "../../components/ui/Pill";
import { formatPercent } from "../../lib/format";
import { CandidateStatus } from "./CandidateStatus";
import type { ProviderCandidate } from "./booking-actions.types";

export interface AssignCandidateTableProps {
  candidates: readonly ProviderCandidate[];
  onSelect: (candidate: ProviderCandidate) => void;
  isSubmitting: boolean;
}

const ASSIGN_VARIANTS = {
  available: "outline",
  onJob: "outlineWarning",
  declined: "outlineMuted",
} as const;

/**
 * A table rather than a list of cards: the choice here is comparative — nearest versus fastest
 * versus least loaded — and only columns let the eye run down one factor at a time.
 *
 * Seven columns, not nine: jobs-today and completion fold into a second line under the provider
 * name (as the mobile cards already do), because at the modal's widest the nine-column layout
 * pushed STATUS and the Assign buttons past an invisible horizontal scroll — a table an operator
 * cannot see how to act on.
 */
export function AssignCandidateTable({
  candidates,
  onSelect,
  isSubmitting,
}: AssignCandidateTableProps) {
  const { t } = useTranslation("adminBookingActions");

  const columns: readonly DataTableColumn<ProviderCandidate>[] = [
    {
      id: "provider",
      header: t("assign.column.provider"),
      render: (row) => (
        <span className="flex items-center gap-s2">
          <Avatar name={row.name} size="sm" />
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-s2">
              <span className="truncate text-caption font-semibold text-text-1">{row.name}</span>
              {row.isBestMatch ? <Pill tone="info">{t("assign.bestMatch")}</Pill> : null}
            </span>
            <span className="text-caption text-text-3">
              {t("assign.cardLoad", {
                jobs: row.jobsToday,
                completion: formatPercent(row.completionRate),
              })}
            </span>
          </span>
        </span>
      ),
    },
    {
      id: "distance",
      header: t("assign.column.distance"),
      numeric: true,
      render: (row) => t("shared.km", { value: row.distanceKm }),
    },
    {
      id: "eta",
      header: t("assign.column.eta"),
      numeric: true,
      render: (row) => t("shared.etaMinutes", { value: row.etaMinutes }),
    },
    {
      id: "skills",
      header: t("assign.column.skills"),
      render: (row) =>
        row.skillLabel ? (
          <span className="flex items-start gap-s1">
            <Icon glyph={Check} size="sm" className="text-success" />
            <span className="text-caption text-text-1">{row.skillLabel}</span>
          </span>
        ) : (
          <span className="text-caption text-text-3">{t("shared.none")}</span>
        ),
    },
    {
      id: "rating",
      header: t("assign.column.rating"),
      numeric: true,
      render: (row) => (
        <span className="inline-flex items-center gap-s1">
          <Icon glyph={Star} size="sm" className="text-warning" />
          <span>{row.rating}</span>
        </span>
      ),
    },
    {
      id: "status",
      header: t("assign.column.status"),
      render: (row) => <CandidateStatus candidate={row} />,
    },
    {
      id: "action",
      header: t("assign.column.action"),
      render: (row) => (
        <Button
          variant={row.isBestMatch ? "outlineBrand" : ASSIGN_VARIANTS[row.availability]}
          size="inline"
          disabled={isSubmitting}
          onClick={() => onSelect(row)}
        >
          {t("assign.assign")}
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      caption={t("assign.tableCaption")}
      columns={columns}
      rows={candidates}
      rowKey={(row) => row.providerId}
      density="roomy"
      tight
    />
  );
}
