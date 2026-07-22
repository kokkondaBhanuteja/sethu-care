import type { ReactElement, ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { normalizeError } from "../../lib/http/apiError";
import { ErrorState } from "../ui/ErrorState";
import { FilteredEmptyState } from "../ui/states/FilteredEmptyState";

export interface QueryBoundaryProps<TData> {
  query: UseQueryResult<TData>;
  /** Drawn on first load only — a refetch keeps the existing content on screen (spec §4.10). */
  skeleton: ReactElement;
  /** What "nothing to show" means for this data. Omit when the screen can't be empty. */
  isEmpty?: (data: TData) => boolean;
  /** The genuinely-empty state: an illustration, an explanation, and a way forward. */
  empty?: ReactElement;
  /**
   * True when a filter or search term is narrowing the result. Empty-because-filtered gets its own
   * state with "Clear filters", because "Nothing here yet" over a hidden list reads as a bug.
   */
  isFiltered?: boolean;
  onClearFilters?: () => void;
  /** Fill the remaining height — set on full-screen lists, unset inside a panel. */
  grow?: boolean;
  children: (data: TData) => ReactNode;
}

/**
 * The single switch between the five states every data-driven section must handle: initial loading,
 * error + retry, empty, empty-because-filtered, and data. Implementing this once is what keeps the
 * eleven §4.10 states consistent across ~40 screens instead of being re-invented per screen.
 *
 * Refresh loading, offline, stale and not-found are deliberately NOT here: they are conditions of
 * the shell or the record, and each has its own component.
 */
export function QueryBoundary<TData>({
  query,
  skeleton,
  isEmpty,
  empty,
  isFiltered = false,
  onClearFilters,
  grow = false,
  children,
}: QueryBoundaryProps<TData>) {
  if (query.isPending) return skeleton;

  if (query.isError) {
    return (
      <ErrorState
        error={normalizeError(query.error, "This could not be loaded.")}
        onRetry={() => void query.refetch()}
        grow={grow}
      />
    );
  }

  const { data } = query;

  if (isEmpty?.(data)) {
    if (isFiltered && onClearFilters) {
      return <FilteredEmptyState onClearFilters={onClearFilters} grow={grow} />;
    }
    return empty ?? null;
  }

  return <>{children(data)}</>;
}
