import { AlertTriangle, Ban, CheckCircle2, Clock } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Avatar } from "../../../components/ui/Avatar";
import { DataTable, type DataTableColumn } from "../../../components/ui/DataTable";
import { Icon } from "../../../components/ui/Icon";
import { Pill } from "../../../components/ui/Pill";
import { formatDate } from "../../../lib/format";
import { ROUTES } from "../../../routes/routes.constants";
import { APPLICATION_STATUSES, type ApplicationRow } from "../applications.types";
import { ApplicationAgePill, DocumentCompleteness } from "./ApplicationAge";

export interface ApplicationsTableProps {
  rows: readonly ApplicationRow[];
}

/**
 * Sorted oldest first: the only thing that matters in this queue is which application is closest
 * to breaching the 48-hour decision target. The severity tint, the ageing pill and the SLA line
 * above the table all encode that, so it survives a colourblind reading.
 */
export function ApplicationsTable({ rows }: ApplicationsTableProps) {
  const { t } = useTranslation("adminProviders");
  const navigate = useNavigate();

  const columns: readonly DataTableColumn<ApplicationRow>[] = [
    {
      id: "applicant",
      header: t("applications.columnApplicant"),
      render: (row) => (
        <span className="flex items-center gap-s2">
          <Avatar name={row.applicantName} size="sm" />
          <span className="text-emph text-text-1">{row.applicantName}</span>
        </span>
      ),
    },
    {
      id: "categories",
      header: t("applications.columnCategories"),
      render: (row) => <span className="text-text-2">{row.categories.join(", ")}</span>,
    },
    {
      id: "zone",
      header: t("applications.columnZone"),
      render: (row) => <span className="text-text-2">{row.zone}</span>,
    },
    {
      id: "applied",
      header: t("applications.columnApplied"),
      render: (row) => (
        <span className="whitespace-nowrap text-text-2">{formatDate(row.appliedAt)}</span>
      ),
    },
    {
      id: "waiting",
      header: t("applications.columnWaiting"),
      render: (row) =>
        row.daysWaiting === null ? (
          <span className="text-text-3">—</span>
        ) : (
          <ApplicationAgePill days={row.daysWaiting} />
        ),
    },
    {
      id: "documents",
      header: t("applications.columnDocuments"),
      render: (row) => (
        <DocumentCompleteness
          present={row.documentsPresent}
          required={row.documentsRequired}
          layout="inline"
        />
      ),
    },
    {
      id: "status",
      header: t("applications.columnStatus"),
      render: (row) => <ApplicationStatusCell row={row} />,
    },
  ];

  return (
    <DataTable
      caption={t("applications.tableCaption")}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      rowTone={(row) => rowTone(row)}
      onRowClick={(row) => void navigate(ROUTES.applicationReview(row.id))}
    />
  );
}

/** Overdue against the 48-hour SLA is red; approaching it is amber; decided rows are plain. */
function rowTone(row: ApplicationRow): "default" | "danger" | "warning" {
  if (row.daysWaiting === null) return "default";
  if (row.daysWaiting > 3) return "danger";
  if (row.daysWaiting > 2) return "warning";
  return "default";
}

function ApplicationStatusCell({ row }: { row: ApplicationRow }) {
  const { t } = useTranslation("adminProviders");

  if (row.status === APPLICATION_STATUSES.approved && row.decidedAt) {
    return (
      <Pill tone="success" icon={CheckCircle2}>
        {t("applications.statusApproved", { date: formatDate(row.decidedAt) })}
      </Pill>
    );
  }
  if (row.status === APPLICATION_STATUSES.rejected && row.decidedAt) {
    return (
      <Pill tone="danger" icon={Ban}>
        {t("applications.statusRejected", { date: formatDate(row.decidedAt) })}
      </Pill>
    );
  }
  if (row.status === APPLICATION_STATUSES.awaitingDocs && row.awaitingDocumentKey) {
    return (
      <span className="flex items-center gap-s1 text-label text-warning">
        <Icon glyph={AlertTriangle} size="sm" />
        {t("applications.statusAwaiting", { document: t(row.awaitingDocumentKey) })}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-s1 text-label text-text-1">
      <Icon glyph={Clock} size="sm" className="text-text-2" />
      {t("applications.statusPending")}
    </span>
  );
}
