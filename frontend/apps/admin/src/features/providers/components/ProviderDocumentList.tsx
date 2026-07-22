import { AlertTriangle, CheckCircle2, ChevronRight, FileText } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Icon } from "../../../components/ui/Icon";
import { cx } from "../../../lib/cx";
import { formatDate } from "../../../lib/format";
import { DOCUMENT_STATES, type ProviderDocument } from "../providers.types";

const STATE_TEXT = {
  [DOCUMENT_STATES.verified]: "text-success",
  [DOCUMENT_STATES.expiring]: "text-warning",
  [DOCUMENT_STATES.expired]: "text-danger",
} as const;

export interface ProviderDocumentListProps {
  documents: readonly ProviderDocument[];
  /** Desktop opens the viewer from a row; mobile shows a chevron to the read-only detail. */
  onOpen?: (document: ProviderDocument) => void;
}

/**
 * Expiry is stated as a date, not a colour: "Expired 18/07" is what tells an ops manager the
 * document list agrees with the banner above it (BOX 42 / M67).
 */
export function ProviderDocumentList({ documents, onOpen }: ProviderDocumentListProps) {
  const { t } = useTranslation("adminProviders");

  function statusLine(document: ProviderDocument): string {
    if (document.state === DOCUMENT_STATES.expired) {
      return t("profile.documentExpired", {
        date: document.expiresAt ? formatDate(document.expiresAt) : "",
      });
    }
    if (document.state === DOCUMENT_STATES.expiring) {
      return t("profile.documentExpiring", { count: document.daysToExpiry ?? 0 });
    }
    return t("profile.documentVerified");
  }

  return (
    <ul className="list-none">
      {documents.map((document, index) => (
        <li
          key={document.id}
          className={cx(
            "flex h-row-56 items-center gap-s3",
            index < documents.length - 1 && "border-b border-border-subtle",
          )}
        >
          <span className="flex size-row-40 flex-none items-center justify-center rounded-pill border border-border-subtle bg-inset">
            <Icon glyph={FileText} size="sm" className="text-text-2" />
          </span>
          <span className="grow min-w-0">
            <span className="block truncate text-emph text-text-1">{t(document.typeKey)}</span>
            <span
              className={cx("flex items-center gap-s1 text-caption", STATE_TEXT[document.state])}
            >
              <Icon
                glyph={document.state === DOCUMENT_STATES.verified ? CheckCircle2 : AlertTriangle}
                size="sm"
              />
              {statusLine(document)}
            </span>
          </span>
          {onOpen ? (
            <button
              type="button"
              className="flex-none"
              onClick={() => onOpen(document)}
              aria-label={t(document.typeKey)}
            >
              <Icon glyph={ChevronRight} className="text-text-3" />
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
