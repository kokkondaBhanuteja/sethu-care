import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Card } from "../../../components/ui/Card";
import { formatDate } from "../../../lib/format";
import { ROUTES } from "../../../routes/routes.constants";
import { APPLICATION_STATUSES, type ApplicationRow } from "../applications.types";
import { ApplicationAgePill, DocumentCompleteness } from "./ApplicationAge";

export interface ApplicationCardProps {
  row: ApplicationRow;
}

/**
 * The mobile queue row. An application waiting on the APPLICANT carries no coloured edge and sits
 * on the recessed fill: giving it an amber edge would put an item the ops manager cannot act on
 * into the same visual class as the two that are on her clock (M69).
 */
export function ApplicationCard({ row }: ApplicationCardProps) {
  const { t } = useTranslation("adminProviders");
  const isWaitingOnApplicant = row.status === APPLICATION_STATUSES.awaitingDocs;
  const isOverdue = (row.daysWaiting ?? 0) > 3;

  return (
    <Link to={ROUTES.applicationReview(row.id)} className="block">
      <Card
        tone={isWaitingOnApplicant ? "surface" : "plain"}
        edge={isWaitingOnApplicant ? "none" : isOverdue ? "danger" : "warning"}
      >
        <div className="flex items-center justify-between gap-s2">
          <span className="truncate text-emph text-text-1">{row.applicantName}</span>
          {row.daysWaiting === null ? null : (
            <ApplicationAgePill days={row.daysWaiting} onTint={isWaitingOnApplicant} />
          )}
        </div>

        <p className="mt-s1 text-label text-text-2">
          {row.categories.join(", ")} · {row.zone}
        </p>
        <p className="mt-s1 text-caption text-text-3">
          {t("applications.appliedOn", { date: formatDate(row.appliedAt) })}
        </p>

        <div className="mt-s3">
          <DocumentCompleteness
            present={row.documentsPresent}
            required={row.documentsRequired}
            layout="stacked"
          />
        </div>

        {isWaitingOnApplicant && row.awaitingDocumentKey ? (
          <p className="mt-s2 text-caption text-text-3">
            {t("applications.statusWaitingOn", { document: t(row.awaitingDocumentKey) })}
          </p>
        ) : null}
      </Card>
    </Link>
  );
}
