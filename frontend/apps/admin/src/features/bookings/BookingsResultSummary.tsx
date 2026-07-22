import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { MonoText } from "./RecordText";

export interface BookingsResultSummaryProps {
  /** Empty while no search is narrowing the list — the summary then renders nothing. */
  search: string;
  total: number;
  isAcrossSegments: boolean;
  onClearSearch: () => void;
}

/**
 * The result count and its escape hatch, above the header row. A narrowed list with no statement of
 * why it is narrowed is the fastest way to convince an operator the queue is broken.
 */
export function BookingsResultSummary({
  search,
  total,
  isAcrossSegments,
  onClearSearch,
}: BookingsResultSummaryProps) {
  const { t } = useTranslation("adminBookings");
  if (!search) return null;

  return (
    <div className="flex flex-wrap items-center gap-s3 px-s2 pt-s3 pb-s2">
      <p className="text-caption text-text-3" aria-live="polite">
        {total === 1 ? t("search.resultCountOne") : t("search.resultCountMany", { count: total })}{" "}
        <MonoText className="text-caption">{search}</MonoText>
      </p>
      <Button variant="textBrand" size="inline" onClick={onClearSearch}>
        {t("search.clear")}
      </Button>
      {isAcrossSegments ? (
        <p className="w-full text-caption text-text-3">
          {t("search.acrossSegments", { count: total })}
        </p>
      ) : null}
    </div>
  );
}
