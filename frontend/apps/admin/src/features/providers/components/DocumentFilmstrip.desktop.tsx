import { AlertTriangle, CheckCircle2, FileText, XCircle } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Icon } from "../../../components/ui/Icon";
import { cx } from "../../../lib/cx";
import { formatDate } from "../../../lib/format";
import { DOCUMENT_VALIDATIONS, type ApplicationDocument } from "../applications.types";

const VERDICT_ICON = {
  [DOCUMENT_VALIDATIONS.validated]: CheckCircle2,
  [DOCUMENT_VALIDATIONS.failed]: AlertTriangle,
  [DOCUMENT_VALIDATIONS.missing]: XCircle,
} as const;

const VERDICT_TONE = {
  [DOCUMENT_VALIDATIONS.validated]: "text-success",
  [DOCUMENT_VALIDATIONS.failed]: "text-warning",
  [DOCUMENT_VALIDATIONS.missing]: "text-danger",
} as const;

export interface DocumentFilmstripProps {
  documents: readonly ApplicationDocument[];
  selectedId: string;
  onSelect: (documentId: string) => void;
}

/**
 * Each thumbnail carries its own auto-validation verdict, so the reviewer knows which scan to open
 * before opening it — which is what makes a five-document review one decision rather than five.
 */
export function DocumentFilmstrip({ documents, selectedId, onSelect }: DocumentFilmstripProps) {
  const { t } = useTranslation("adminProviders");
  const selectedIndex = documents.findIndex((document) => document.id === selectedId);
  const selected = documents[selectedIndex];

  return (
    <div className="flex items-center gap-s2" role="group" aria-label={t("review.filmstripLabel")}>
      {documents.map((document) => {
        const isSelected = document.id === selectedId;
        return (
          <button
            key={document.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(document.id)}
            title={t(document.typeKey)}
            className={cx(
              "relative flex size-row-72 flex-none items-center justify-center rounded-pill border bg-inset",
              isSelected ? "border-brand" : "border-border-subtle",
            )}
          >
            <Icon glyph={FileText} size="lg" className="text-text-2" />
            <span className="absolute bottom-s1 right-s1 rounded-full bg-canvas">
              <Icon
                glyph={VERDICT_ICON[document.validation]}
                size="sm"
                className={VERDICT_TONE[document.validation]}
              />
            </span>
            <span className="sr-only">{t(document.typeKey)}</span>
          </button>
        );
      })}

      {selected ? (
        <span className="ml-s3 flex flex-col justify-center">
          <span className="text-emph text-text-1">{t(selected.typeKey)}</span>
          <span className="text-caption text-text-3">
            {t("review.viewerMeta", {
              index: selectedIndex + 1,
              total: documents.length,
              date: selected.uploadedAt ? formatDate(selected.uploadedAt) : "",
              size: selected.sizeLabel ?? "",
            })}
          </span>
        </span>
      ) : null}
    </div>
  );
}
