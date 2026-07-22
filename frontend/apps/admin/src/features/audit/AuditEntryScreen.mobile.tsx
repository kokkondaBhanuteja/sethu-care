import { Lock } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Banner } from "../../components/ui/Banner";
import { Card } from "../../components/ui/Card";
import { NotFoundState } from "../../components/ui/states/NotFoundState";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { API_ERROR_CODES, normalizeError } from "../../lib/http/apiError";
import { MobileAppBar } from "../../layouts/MobileAppBar";
import { AuditEntryDetail } from "./AuditEntryDetail";
import { AuditDetailSkeleton } from "./AuditSkeletons";
import { useAuditEntry } from "./useAuditEntry";

export interface AuditEntryScreenMobileProps {
  entryId: string;
  onBack: () => void;
  onOpenEntry: (entryId: string) => void;
}

/**
 * The pushed detail screen (BOX 76). No overflow menu in the app bar: there is nothing to do to
 * this record. The immutability strip is pinned under the scroll region so the guarantee is never
 * scrolled past.
 */
export function AuditEntryScreenMobile({
  entryId,
  onBack,
  onOpenEntry,
}: AuditEntryScreenMobileProps) {
  const { t } = useTranslation("adminAudit");
  const query = useAuditEntry(entryId);
  const isMissing =
    query.isError && normalizeError(query.error, "").code === API_ERROR_CODES.notFound;

  return (
    <>
      <MobileAppBar title={t("entryTitle")} showBack compact bordered onBack={onBack} />

      <div className="screen__scroll">
        <div className="px-s4 pt-s3 pb-s4">
          {isMissing ? (
            <NotFoundState />
          ) : (
            /* The record floats on the canvas as a Card, the same surface every sibling detail
               screen uses — a flat def-list reads as an unfinished page (BOX 76). */
            <Card>
              <QueryBoundary query={query} skeleton={<AuditDetailSkeleton />}>
                {(entry) => (
                  <AuditEntryDetail
                    entry={entry}
                    showFooterNote={false}
                    onOpenEntry={onOpenEntry}
                  />
                )}
              </QueryBoundary>
            </Card>
          )}
        </div>
      </div>

      {/* Pinned, so the guarantee is never scrolled past (BOX 76). */}
      <Banner tone="info" icon={Lock} title={t("immutability.entry")} />
    </>
  );
}
