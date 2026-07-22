import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { useProviderRosterQuery } from "../queries/providers.queries";
import { STATUS_STALE_AFTER_MS } from "../providers.constants";
import { ROSTER_VARIANTS, type RosterVariant } from "../providers.mock";
import { ROSTER_SEGMENTS, type RosterSegment } from "../providers.types";

/** Selects the designed roster variants without editing code — see the feature CLAUDE.md. */
const VARIANT_PARAM = "state";

function isRosterVariant(value: string): value is RosterVariant {
  return Object.values(ROSTER_VARIANTS).includes(value as RosterVariant);
}

/**
 * The one roster hook. Desktop renders a DataTable and mobile renders stacked cards, but the
 * segment, the search term, the query and the staleness verdict are decided here exactly once —
 * which is what stops the two surfaces drifting apart (spec §2.1).
 */
export function useProviderRoster() {
  const [searchParams] = useSearchParams();
  const [segment, setSegment] = useState<RosterSegment>(ROSTER_SEGMENTS.online);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm);

  const rawVariant = searchParams.get(VARIANT_PARAM) ?? ROSTER_VARIANTS.normal;
  const variant = isRosterVariant(rawVariant) ? rawVariant : ROSTER_VARIANTS.normal;

  const query = useProviderRosterQuery(segment, debouncedSearch, variant);

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setSegment(ROSTER_SEGMENTS.all);
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
    query,
    clearFilters,
    /** Search narrows the list, so an empty result needs the filtered-empty state, not "nothing yet". */
    isFiltered: debouncedSearch.length > 0,
    /** A live status this old is a wrong answer, not stale detail (M36). */
    isStale: statusAgeMs > STATUS_STALE_AFTER_MS,
    statusAgeMs,
  };
}
