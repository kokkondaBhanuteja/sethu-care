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
 * paging is deliberately absent rather than omitted. NOT swapped for @sethu/ui-web Pagination in
 * P3: that component is a numbered page-window pager, which is exactly the model this queue
 * console rejects — recorded as an API gap, restyled on tokens instead.
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
    <div className="flex items-center justify-between gap-3 px-2 pt-3">
      <p className="text-xs text-faint" aria-live="polite">
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
