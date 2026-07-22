// The audit log's shared logic. Both shells call this hook and neither owns a rule of its own —
// the anti-drift rule (spec §2.1): desktop and mobile differ in layout, never in behaviour.

import { useCallback, useMemo, useState } from "react";
import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";

import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { fetchAuditAdmins, fetchAuditPage } from "./audit.api";
import { AUDIT_DEFAULT_FILTERS, AUDIT_PAGE_SIZE, AUDIT_QUERY_KEYS } from "./audit.constants";
import type { AuditAdmin, AuditFilters, AuditPage } from "./audit.types";

export interface UseAuditLogResult {
  /** Raw search box value — debounced before it reaches the query. */
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  /** The filters actually in force, search included. */
  filters: AuditFilters;
  patchFilters: (patch: Partial<AuditFilters>) => void;
  clearFilters: () => void;
  isFiltered: boolean;
  query: UseQueryResult<AuditPage>;
  admins: readonly AuditAdmin[];
  loadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
}

function isNarrowed(filters: AuditFilters): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.adminId !== null ||
    filters.action !== null ||
    filters.targetType !== null ||
    filters.range !== AUDIT_DEFAULT_FILTERS.range
  );
}

export function useAuditLog(): UseAuditLogResult {
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState<AuditFilters>(AUDIT_DEFAULT_FILTERS);
  const [cursor, setCursor] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(searchTerm);

  const filters = useMemo<AuditFilters>(
    () => ({ ...draft, search: debouncedSearch }),
    [draft, debouncedSearch],
  );

  const query = useQuery({
    queryKey: [...AUDIT_QUERY_KEYS.page(filters), cursor],
    queryFn: ({ signal }) => fetchAuditPage({ ...filters, cursor, limit: AUDIT_PAGE_SIZE }, signal),
    // Load more and a filter change both keep the previous page on screen while the next one
    // arrives, which is the "refresh loading" state (§4.10) rather than a second skeleton.
    placeholderData: keepPreviousData,
  });

  const adminsQuery = useQuery({
    queryKey: [...AUDIT_QUERY_KEYS.root, "admins"],
    queryFn: ({ signal }) => fetchAuditAdmins(signal),
  });

  const patchFilters = useCallback((patch: Partial<AuditFilters>) => {
    // Any change to the filter set invalidates the cursor: page 2 of a different question.
    setCursor(null);
    if (patch.search !== undefined) setSearchTerm(patch.search);
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const clearFilters = useCallback(() => {
    setCursor(null);
    setSearchTerm("");
    setDraft(AUDIT_DEFAULT_FILTERS);
  }, []);

  const nextCursor = query.data?.nextCursor ?? null;
  const loadMore = useCallback(() => {
    if (nextCursor) setCursor(nextCursor);
  }, [nextCursor]);

  return {
    searchTerm,
    setSearchTerm: (value: string) => {
      setCursor(null);
      setSearchTerm(value);
    },
    filters,
    patchFilters,
    clearFilters,
    isFiltered: isNarrowed(filters),
    query,
    admins: adminsQuery.data ?? [],
    loadMore,
    hasMore: nextCursor !== null,
    isLoadingMore: query.isFetching && query.data !== undefined,
  };
}
