import { useCallback, useMemo, useState } from "react";
import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";

import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { fetchBookings } from "./bookings.api";
import {
  BOOKINGS_PAGE_SIZE,
  BOOKING_QUERY_KEYS,
  BOOKING_SEGMENTS,
  SEARCH_MIN_LENGTH,
  SEGMENT_STATES,
  type BookingSegment,
  type BookingState,
} from "./bookings.constants";
import type { BookingsPage } from "./bookings.types";

export interface BookingsListController {
  readonly segment: BookingSegment;
  readonly selectSegment: (segment: BookingSegment) => void;
  /** What is in the field right now — the debounced value is what reaches the query. */
  readonly searchTerm: string;
  readonly updateSearch: (value: string) => void;
  /** The term actually narrowing the result set, or "" while it is below the minimum length. */
  readonly activeSearch: string;
  readonly selectedStates: readonly BookingState[];
  readonly toggleState: (state: BookingState) => void;
  /** Wholesale replacement — the desktop filter band's Select and the column filter both use it. */
  readonly replaceStates: (states: readonly BookingState[]) => void;
  readonly availableStates: readonly BookingState[];
  readonly isFilterOpen: boolean;
  readonly setFilterOpen: (isOpen: boolean) => void;
  readonly appliedFilterCount: number;
  readonly isFiltered: boolean;
  readonly clearFilters: () => void;
  readonly query: UseQueryResult<BookingsPage>;
  readonly loadMore: () => void;
  readonly canLoadMore: boolean;
}

/**
 * The single source of list behaviour for both shells (spec §2.1's anti-drift rule): the desktop
 * table and the mobile card stack render the same segment, search, filter and paging state, so a
 * fix to "search does not reset paging" can only ever be made once.
 */
export function useBookingsList(): BookingsListController {
  const [segment, setSegment] = useState<BookingSegment>(BOOKING_SEGMENTS.active);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStates, setSelectedStates] = useState<readonly BookingState[]>([]);
  const [isFilterOpen, setFilterOpen] = useState(false);
  const [pageCount, setPageCount] = useState(1);

  const debouncedSearch = useDebouncedValue(searchTerm);
  const trimmedSearch = debouncedSearch.trim();
  // Spec §6.8: search is server-side and only fires from three characters — one or two would ask
  // the backend to rank most of the table.
  const activeSearch = trimmedSearch.length >= SEARCH_MIN_LENGTH ? trimmedSearch : "";
  const limit = pageCount * BOOKINGS_PAGE_SIZE;

  const query = useQuery({
    queryKey: BOOKING_QUERY_KEYS.list(segment, activeSearch, selectedStates, limit),
    queryFn: ({ signal }) =>
      fetchBookings({ segment, search: activeSearch, states: selectedStates, limit }, signal),
    // A narrowed query keeps the previous rows on screen while the new ones arrive: the §4.10
    // refresh-loading rule, which forbids blanking content the operator is already reading.
    placeholderData: keepPreviousData,
  });

  const selectSegment = useCallback((next: BookingSegment) => {
    setSegment(next);
    setPageCount(1);
  }, []);

  const updateSearch = useCallback((value: string) => {
    setSearchTerm(value);
    setPageCount(1);
  }, []);

  const toggleState = useCallback((state: BookingState) => {
    setSelectedStates((current) =>
      current.includes(state)
        ? current.filter((candidate) => candidate !== state)
        : [...current, state],
    );
    setPageCount(1);
  }, []);

  const replaceStates = useCallback((states: readonly BookingState[]) => {
    setSelectedStates(states);
    setPageCount(1);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setSelectedStates([]);
    setPageCount(1);
  }, []);

  const loadMore = useCallback(() => setPageCount((current) => current + 1), []);

  const availableStates = useMemo(() => SEGMENT_STATES[segment], [segment]);
  const appliedFilterCount = selectedStates.length;
  const shown = query.data?.items.length ?? 0;
  const total = query.data?.total ?? 0;

  return {
    segment,
    selectSegment,
    searchTerm,
    updateSearch,
    activeSearch,
    selectedStates,
    toggleState,
    replaceStates,
    availableStates,
    isFilterOpen,
    setFilterOpen,
    appliedFilterCount,
    isFiltered: appliedFilterCount > 0 || activeSearch.length > 0,
    clearFilters,
    query,
    loadMore,
    canLoadMore: shown < total,
  };
}
