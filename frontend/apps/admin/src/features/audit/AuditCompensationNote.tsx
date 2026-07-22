import { Info } from "lucide-react";
import { Trans, useTranslation } from "@sethu/i18n";

import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import type { AuditEntry } from "./audit.types";

export interface AuditCompensationNoteProps {
  entry: AuditEntry;
  onOpenEntry: (entryId: string) => void;
}

/**
 * The whole argument for an append-only ledger, stated at the point of use (BOX 50).
 *
 * Actions with no undo window — refund, manual completion (§10.3) — are corrected by a later
 * compensating action, which is itself audited. The correction is a NEW entry; the entry it
 * corrects is untouched. Both directions of that link are rendered so an operator reading either
 * row can reach the other, but neither carries an "amended" flag: a flag would imply the original
 * changed, and it did not.
 */
export function AuditCompensationNote({ entry, onOpenEntry }: AuditCompensationNoteProps) {
  const { t } = useTranslation("adminAudit");
  const corrects = entry.compensatesEntryId;
  const correctedBy = entry.compensatedByEntryId;

  if (!corrects && !correctedBy) return null;

  const linkedId = corrects ?? correctedBy ?? "";
  const key = corrects ? "compensating.corrects" : "compensating.correctedBy";

  return (
    <Card tone="info" density="tight" className="mb-s3">
      <div className="flex items-start gap-s2">
        <Icon glyph={Info} className="text-brand" />
        <p className="text-label text-brand">
          <Trans
            ns="adminAudit"
            i18nKey={key}
            values={{ entryId: linkedId }}
            components={{
              ref: (
                <button
                  type="button"
                  className="font-mono tabular-nums text-mono text-brand underline"
                  onClick={() => onOpenEntry(linkedId)}
                >
                  {linkedId}
                </button>
              ),
            }}
          />
        </p>
        <span className="sr-only">{t("compensating.srHint")}</span>
      </div>
    </Card>
  );
}
