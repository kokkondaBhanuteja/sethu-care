import type { HTMLAttributes, ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { cn } from "../lib/cn";
import { Button } from "./Button";

// The card-footer pager from the refs: summary line left, first/prev + numbered window +
// next/last right. Fully controlled — the caller owns `page` and reacts to `onPageChange` — and
// every string arrives via props because localisation lives in the apps. Numbered buttons hide
// on phones (the chevrons carry the job); the summary keeps position visible there.
export interface PaginationLabels {
  first: string;
  previous: string;
  next: string;
  last: string;
  /** Accessible name for a numbered button — e.g. (pageNumber) => `Page ${pageNumber}`. */
  page: (pageNumber: number) => string;
}

export interface PaginationProps extends HTMLAttributes<HTMLElement> {
  /** Accessible name for the nav landmark — caller localizes (e.g. "Pagination"). */
  "aria-label": string;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  labels: PaginationLabels;
  /** Localised "Page X of Y" line. Omit to render controls only. */
  summary?: ReactNode;
  /** Width of the numbered window; the window slides to keep the current page centred. */
  maxVisiblePages?: number;
}

function visiblePageNumbers(page: number, pageCount: number, maxVisible: number): number[] {
  const windowStart = Math.max(
    1,
    Math.min(page - Math.floor(maxVisible / 2), pageCount - maxVisible + 1),
  );
  const windowEnd = Math.min(pageCount, windowStart + maxVisible - 1);
  const pageNumbers: number[] = [];
  for (let pageNumber = windowStart; pageNumber <= windowEnd; pageNumber += 1) {
    pageNumbers.push(pageNumber);
  }
  return pageNumbers;
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  labels,
  summary,
  maxVisiblePages = 5,
  className,
  ...props
}: PaginationProps) {
  const isAtFirstPage = page <= 1;
  const isAtLastPage = page >= pageCount;
  return (
    <nav className={cn("flex items-center justify-between gap-3", className)} {...props}>
      {summary ? <span className="text-sm text-muted">{summary}</span> : null}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label={labels.first}
          disabled={isAtFirstPage}
          onClick={() => onPageChange(1)}
        >
          <ChevronsLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={labels.previous}
          disabled={isAtFirstPage}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <div className="hidden items-center gap-1 sm:flex">
          {visiblePageNumbers(page, pageCount, maxVisiblePages).map((pageNumber) => (
            <Button
              key={pageNumber}
              variant={pageNumber === page ? "outline" : "ghost"}
              size="icon"
              aria-label={labels.page(pageNumber)}
              aria-current={pageNumber === page ? "page" : undefined}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={labels.next}
          disabled={isAtLastPage}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={labels.last}
          disabled={isAtLastPage}
          onClick={() => onPageChange(pageCount)}
        >
          <ChevronsRight />
        </Button>
      </div>
    </nav>
  );
}
