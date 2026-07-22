import { useTranslation } from "@sethu/i18n";

import { Pill } from "../../components/ui/Pill";
import type { AuditEvidence } from "./audit.types";

export interface AuditEvidenceTagsProps {
  evidence: AuditEvidence;
}

/**
 * The attachments the action carried. Counts only — the audit log records admin activity, not
 * customer data, so an admin reading the ledger is not incidentally opening a customer's photos
 * (spec §6.29, Privacy).
 */
export function AuditEvidenceTags({ evidence }: AuditEvidenceTagsProps) {
  const { t } = useTranslation("adminAudit");
  const counts = [
    {
      id: "photos",
      count: evidence.photoIds.length,
      label: t("detail.photos", { count: evidence.photoIds.length }),
    },
    {
      id: "callLogs",
      count: evidence.callLogIds.length,
      label: t("detail.callLogs", { count: evidence.callLogIds.length }),
    },
    {
      id: "reports",
      count: evidence.reportIds.length,
      label: t("detail.reports", { count: evidence.reportIds.length }),
    },
  ].filter((item) => item.count > 0);

  if (counts.length === 0) {
    return <span className="text-text-3">{t("detail.noEvidence")}</span>;
  }

  return (
    <span className="flex flex-wrap gap-s2">
      {counts.map((item) => (
        <Pill key={item.id} tone="outline">
          {item.label}
        </Pill>
      ))}
    </span>
  );
}
