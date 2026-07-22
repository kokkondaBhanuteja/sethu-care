import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { useProviderRosterQuery } from "../queries/providers.queries";
import { STATUS_STALE_AFTER_MS } from "../providers.constants";
import { ROSTER_VARIANTS, type RosterVariant } from "../providers.mock";
import { ROSTER_SEGMENTS, type RosterSegment } from "../providers.types";
import {
  EMPTY_ROSTER_REFINEMENTS,
  isRosterRefined,
  refineRosterRows,
  rosterFilterOptions,
  type RosterRefinements,
} from "../rosterFilters";

/** Selects the designed roster variants without editing code — see the feature CLAUDE.md. */
const VARIANT_PARAM = "state";

function isRosterVariantValue(value: string): value is RosterVariant {
  return Object.values(ROSTER_VARIANTS).includes(value as RosterVariant);
}

/**
 * The one roster hook. Desktop renders a DataTable and mobile renders stacked cards, but the
 * segment, the search term, the filter refinements, the query and the staleness verdict are
 * decided here exactly once — which is what stops the two surfaces drifting apart (spec §2.1).
 *
 * Segment + search travel with the query; the skill/zone/status refinements narrow the loaded
 * page client-side (`rosterFilters.ts`), which is why `visibleRows` exists beside `query.data`.
 */
export function useProviderRoster() {
  const [searchParams] = useSearchParams();
  const [segment, setSegment] = useState<RosterSegment>(ROSTER_SEGMENTS.online);
  const [searchTerm, setSearchTerm] = useState("");
  const [refinements, setRefinements] = useState<RosterRefinements>(EMPTY_ROSTER_REFINEMENTS);
  const debouncedSearch = useDebouncedValue(searchTerm);

  const rawVariant = searchParams.get(VARIANT_PARAM) ?? ROSTER_VARIANTS.normal;
  const variant = isRosterVariantValue(rawVariant) ? rawVariant : ROSTER_VARIANTS.normal;

  const query = useProviderRosterQuery(segment, debouncedSearch, variant);
  const loadedRows = query.data?.rows;

  const visibleRows = useMemo(
    () => refineRosterRows(loadedRows ?? [], refinements),
    [loadedRows, refinements],
  );

  /** Options come from the unrefined page so one choice never empties the other dropdowns. */
  const filterOptions = useMemo(() => rosterFilterOptions(loadedRows ?? []), [loadedRows]);

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setSegment(ROSTER_SEGMENTS.all);
    setRefinements(EMPTY_ROSTER_REFINEMENTS);
  }, []);

  const statusAgeMs = useMemo(() => {
    const asOf = query.data?.statusesAsOf;
    return asOf ? Date.now() - new Date(asOf).getTime() : 0;
  }, [query.data?.statusesAsOf]);

  return {
    segment,
    setSegment,
    searchTerm,
    setSearchTerm,
    refinements,
    setRefinements,
    filterOptions,
    visibleRows,
    query,
    clearFilters,
    /** Anything narrowing the list means an empty result is filtered-empty, not "nothing yet". */
    isFiltered: debouncedSearch.length > 0 || isRosterRefined(refinements),
    /** A live status this old is a wrong answer, not stale detail (M36). */
    isStale: statusAgeMs > STATUS_STALE_AFTER_MS,
    statusAgeMs,
  };
}
