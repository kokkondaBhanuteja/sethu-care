// Selecting an entry and loading it in full.
//
// The selection lives in the URL, not in component state, so a disputed action can be linked to,
// bookmarked and reopened — which is what an audit trail is for. On mobile the same parameter is
// what makes the detail a pushed screen the back gesture can leave.

import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { fetchAuditEntry } from "./audit.api";
import { AUDIT_ENTRY_PARAM, AUDIT_QUERY_KEYS } from "./audit.constants";
import type { AuditEntry } from "./audit.types";

export interface UseAuditSelectionResult {
  selectedId: string | null;
  select: (entryId: string) => void;
  clearSelection: () => void;
}

export function useAuditSelection(): UseAuditSelectionResult {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get(AUDIT_ENTRY_PARAM);

  const select = useCallback(
    (entryId: string) => {
      const next = new URLSearchParams(params);
      next.set(AUDIT_ENTRY_PARAM, entryId);
      setParams(next);
    },
    [params, setParams],
  );

  const clearSelection = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete(AUDIT_ENTRY_PARAM);
    setParams(next);
  }, [params, setParams]);

  return { selectedId, select, clearSelection };
}

/** The full entry behind the detail view. Disabled until something is selected. */
export function useAuditEntry(entryId: string | null): UseQueryResult<AuditEntry> {
  return useQuery({
    queryKey: AUDIT_QUERY_KEYS.entry(entryId ?? ""),
    queryFn: ({ signal }) => fetchAuditEntry(entryId ?? "", signal),
    enabled: entryId !== null,
  });
}
