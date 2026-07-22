import { AlertTriangle, Check, ChevronRight, CreditCard, FileText, XCircle } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Icon } from "../../../components/ui/Icon";
import { Pill } from "../../../components/ui/Pill";
import { formatDate } from "../../../lib/format";
import { DOCUMENT_TYPE_KEYS } from "../providers.types";
import { DOCUMENT_VALIDATIONS, type ApplicationDocument } from "../applications.types";

export interface ApplicationDocumentListProps {
  documents: readonly ApplicationDocument[];
}

/**
 * The mobile document list. The OCR reading is spelled out in full under the failing row —
 * "name mismatch" on its own would send the reviewer hunting for what actually differs.
 */
export function ApplicationDocumentList({ documents }: ApplicationDocumentListProps) {
  const { t } = useTranslation("adminProviders");

  function metaLine(document: ApplicationDocument): string {
    if (document.detail) return document.detail;
    if (document.expiresAt) {
      return t("review.documentExpires", { date: formatDate(document.expiresAt) });
    }
    if (document.uploadedAt) {
      return t("review.documentUploaded", { date: formatDate(document.uploadedAt) });
    }
    return "";
  }

  return (
    <ul className="list-none">
      {documents.map((document) => (
        <li
          key={document.id}
          className="flex min-h-row-72 items-start gap-s3 border-b border-border-subtle px-s4 py-s3"
        >
          <span className="flex size-row-48 flex-none items-center justify-center rounded-pill border border-border-subtle bg-inset">
            <Icon
              glyph={document.typeKey === DOCUMENT_TYPE_KEYS.bankDetails ? CreditCard : FileText}
              size="sm"
              className="text-text-2"
            />
          </span>

          <span className="grow min-w-0">
            <span className="block text-emph text-text-1">{t(document.typeKey)}</span>
            <span className="mt-s1 flex flex-wrap items-center gap-s2">
              <span className="text-caption text-text-3">{metaLine(document)}</span>
              <ValidationPill validation={document.validation} />
            </span>
            {document.ocrRead && document.ocrExpected ? (
              <span className="mt-s1 block text-caption text-warning">
                {t("review.ocrDetail", {
                  read: document.ocrRead,
                  expected: document.ocrExpected,
                })}
              </span>
            ) : null}
          </span>

          <Icon glyph={ChevronRight} className="mt-s2 flex-none text-text-3" />
        </li>
      ))}
    </ul>
  );
}

function ValidationPill({ validation }: { validation: ApplicationDocument["validation"] }) {
  const { t } = useTranslation("adminProviders");

  if (validation === DOCUMENT_VALIDATIONS.validated) {
    return (
      <Pill tone="success" icon={Check}>
        {t("review.documentValidated")}
      </Pill>
    );
  }
  if (validation === DOCUMENT_VALIDATIONS.failed) {
    return (
      <Pill tone="warning" icon={AlertTriangle}>
        {t("review.documentFailed")}
      </Pill>
    );
  }
  return (
    <Pill tone="danger" icon={XCircle}>
      {t("review.documentMissing")}
    </Pill>
  );
}
