import { Lock } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Icon } from "../../components/ui/Icon";
import { AuditActionPill } from "./AuditActionPill";
import { AuditCompensationNote } from "./AuditCompensationNote";
import { AuditEntryFields } from "./AuditEntryFields";
import type { AuditEntry } from "./audit.types";

export interface AuditEntryDetailProps {
  entry: AuditEntry;
  /** Desktop pairs the fields two-up and captions the panel; mobile stacks them (BOX 48 vs 76). */
  twoColumn?: boolean;
  showHeading?: boolean;
  /** Desktop closes the card with the guarantee; mobile pins it under the scroll region instead. */
  showFooterNote?: boolean;
  onOpenEntry: (entryId: string) => void;
}

/**
 * The full record. There is no edit control, no delete control, no export control and no overflow
 * menu here, and that absence is the design — the entry is immutable and the closing strip says so
 * rather than leaving the absence to read as an oversight (BOX 48/76).
 */
export function AuditEntryDetail({
  entry,
  twoColumn = false,
  showHeading = false,
  showFooterNote = true,
  onOpenEntry,
}: AuditEntryDetailProps) {
  const { t } = useTranslation("adminAudit");

  return (
    <div>
      {showHeading ? (
        <div className="flex items-center justify-between mb-s2">
          <span className="text-pill uppercase text-text-2">{t("detail.heading")}</span>
          <AuditActionPill action={entry.action} withIcon={entry.compensatesEntryId !== null} />
        </div>
      ) : null}

      <AuditCompensationNote entry={entry} onOpenEntry={onOpenEntry} />

      <AuditEntryFields entry={entry} twoColumn={twoColumn} />

      {/* The guarantee, restated where the record ends. No control follows it. */}
      {showFooterNote ? (
        <div className="flex items-center gap-s1 mt-s3">
          <Icon glyph={Lock} size="sm" className="text-text-3" />
          <span className="text-caption text-text-3">{t("immutability.entry")}</span>
        </div>
      ) : null}
    </div>
  );
}
