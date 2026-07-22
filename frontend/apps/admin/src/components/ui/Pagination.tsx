import { useTranslation } from "@sethu/i18n";

import { Button } from "./Button";

export interface PaginationProps {
  /** Rows currently rendered. */
  shown: number;
  /** Rows the query says exist. */
  total: number;
  /** Trailing context the design puts after the count, e.g. "active bookings". */
  subject?: string;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

/**
 * The design paginates by count line plus "Load more", not by numbered pages — correct for queues
 * an operator scans top-down looking for the worst problem, where page 3 has no meaning. Numbered
 * paging is deliberately absent rather than omitted.
 */
export function Pagination({
  shown,
  total,
  subject,
  onLoadMore,
  isLoadingMore = false,
}: PaginationProps) {
  const { t } = useTranslation("adminShell");
  const hasMore = shown < total;

  return (
    <div className="row-between px-s2 pt-s3">
      <p className="t-caption c-3" aria-live="polite">
        {t("table.showing", { count: shown, total })}
        {subject ? ` ${subject}` : null}
      </p>
      {hasMore && onLoadMore ? (
        <Button variant="textBrand" size="inline" onClick={onLoadMore} isLoading={isLoadingMore}>
          {t("actions.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
