import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { useCan } from "../../lib/permissions/usePermission";
import { ADMIN_ACTIONS } from "../../lib/permissions/actions";
import { fetchAttentionQueue } from "./dashboard.api";
import {
  ATTENTION_FILTER_PARAM,
  ATTENTION_REFETCH_MS,
  DASHBOARD_QUERY_KEYS,
} from "./dashboard.constants";
import {
  ATTENTION_FILTERS,
  isAttentionFilter,
  type AttentionFilter,
  type AttentionQueue,
} from "./dashboard.types";
import { useAcknowledgeAlert, type AcknowledgeController } from "./useAcknowledgeAlert";
import {
  CONNECTION_STATUSES,
  useConnectionStatus,
  type ConnectionStatus,
} from "./useConnectionStatus";

export interface AttentionPermissions {
  readonly acknowledge: boolean;
  readonly assign: boolean;
  readonly call: boolean;
  readonly cancel: boolean;
  readonly redispatch: boolean;
}

export interface NeedsAttentionOptions {
  /** How many rows to take. `null` is the whole queue — the feed; a number is a dashboard preview. */
  readonly limit: number | null;
  /** The dashboard panel has no chips, so it never enters the filtered-empty state. */
  readonly filterable?: boolean;
  /**
   * When set, the feed reveals the fetched queue this many rows at a time behind "Load more".
   * Client-side for now; when `GET /ops/dashboard/attention` pages server-side, `loadMore`
   * becomes the fetch-next-page call and nothing above this hook changes.
   */
  readonly pageSize?: number;
}

export interface NeedsAttentionController {
  readonly query: UseQueryResult<AttentionQueue>;
  readonly filter: AttentionFilter;
  setFilter: (filter: AttentionFilter) => void;
  clearFilters: () => void;
  readonly isFiltered: boolean;
  /** Rows currently revealed; `null` means the whole result renders (no paging requested). */
  readonly visibleCount: number | null;
  loadMore: () => void;
  readonly connection: ConnectionStatus;
  /** Offline disables mutating actions with a stated reason — it never hides them (spec §4.10). */
  readonly isActionBlocked: boolean;
  readonly permissions: AttentionPermissions;
  readonly acknowledgement: AcknowledgeController;
}

/**
 * The one source of behaviour behind BOTH queue renderings: the desktop table and the mobile cards.
 *
 * Desktop renders the records as a table and mobile as stacked cards — that is the entire point of
 * the wider canvas, because an operator scans the AGE and PROVIDER columns down the page to find the
 * worst problem, which stacked cards make impossible. Sharing this hook is what stops the two
 * renderings drifting apart (spec §2.1).
 *
 * The active filter lives in the URL (`?filter=escalated`), not component state, so the alert
 * band's "View all" can land the operator on the escalations it was counting and a shift handover
 * can share a pre-filtered link.
 */
export function useNeedsAttention({
  limit,
  filterable = true,
  pageSize,
}: NeedsAttentionOptions): NeedsAttentionController {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawFilter = searchParams.get(ATTENTION_FILTER_PARAM);
  const urlFilter =
    rawFilter !== null && isAttentionFilter(rawFilter) ? rawFilter : ATTENTION_FILTERS.all;
  const effectiveFilter = filterable ? urlFilter : ATTENTION_FILTERS.all;

  const [visibleCount, setVisibleCount] = useState<number | null>(pageSize ?? null);

  const query = useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.attention(effectiveFilter, limit),
    queryFn: ({ signal }) => fetchAttentionQueue(effectiveFilter, limit, signal),
    refetchInterval: ATTENTION_REFETCH_MS,
  });

  const connection = useConnectionStatus({ failureCount: query.failureCount });
  const acknowledgement = useAcknowledgeAlert();

  const permissions: AttentionPermissions = {
    acknowledge: useCan(ADMIN_ACTIONS.acknowledgeAlert),
    assign: useCan(ADMIN_ACTIONS.assignProvider),
    call: useCan(ADMIN_ACTIONS.contactParty),
    cancel: useCan(ADMIN_ACTIONS.cancelBooking),
    redispatch: useCan(ADMIN_ACTIONS.redispatch),
  };

  const setFilter = useCallback(
    (nextFilter: AttentionFilter) => {
      if (!filterable) return;
      // A narrowed view starts back at its first page — carrying an expanded window across
      // filters would show one filter 25 rows and the next 50 for no reason the operator chose.
      setVisibleCount(pageSize ?? null);
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (nextFilter === ATTENTION_FILTERS.all) params.delete(ATTENTION_FILTER_PARAM);
          else params.set(ATTENTION_FILTER_PARAM, nextFilter);
          return params;
        },
        { replace: true },
      );
    },
    [filterable, pageSize, setSearchParams],
  );

  const clearFilters = useCallback(() => setFilter(ATTENTION_FILTERS.all), [setFilter]);

  const loadMore = useCallback(() => {
    if (pageSize === undefined) return;
    setVisibleCount((current) => (current === null ? pageSize : current + pageSize));
  }, [pageSize]);

  return {
    query,
    filter: effectiveFilter,
    setFilter,
    clearFilters,
    isFiltered: effectiveFilter !== ATTENTION_FILTERS.all,
    visibleCount,
    loadMore,
    connection,
    // Offline disables mutating affordances with a stated reason; it never hides them, because a
    // control that vanishes reads as "not allowed" rather than "not right now" (spec §4.10).
    isActionBlocked: connection === CONNECTION_STATUSES.offline,
    permissions,
    acknowledgement,
  };
}
