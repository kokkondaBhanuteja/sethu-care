import { useCallback, useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { useCan } from "../../lib/permissions/usePermission";
import { ADMIN_ACTIONS } from "../../lib/permissions/actions";
import { fetchAttentionQueue } from "./dashboard.api";
import { ATTENTION_REFETCH_MS, DASHBOARD_QUERY_KEYS } from "./dashboard.constants";
import { ATTENTION_FILTERS, type AttentionFilter, type AttentionQueue } from "./dashboard.types";
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
}

export interface NeedsAttentionController {
  readonly query: UseQueryResult<AttentionQueue>;
  readonly filter: AttentionFilter;
  setFilter: (filter: AttentionFilter) => void;
  clearFilters: () => void;
  readonly isFiltered: boolean;
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
 */
export function useNeedsAttention({
  limit,
  filterable = true,
}: NeedsAttentionOptions): NeedsAttentionController {
  const [filter, setFilter] = useState<AttentionFilter>(ATTENTION_FILTERS.all);
  const effectiveFilter = filterable ? filter : ATTENTION_FILTERS.all;

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

  const clearFilters = useCallback(() => setFilter(ATTENTION_FILTERS.all), []);

  return {
    query,
    filter: effectiveFilter,
    setFilter,
    clearFilters,
    isFiltered: effectiveFilter !== ATTENTION_FILTERS.all,
    connection,
    // Offline disables mutating affordances with a stated reason; it never hides them, because a
    // control that vanishes reads as "not allowed" rather than "not right now" (spec §4.10).
    isActionBlocked: connection === CONNECTION_STATUSES.offline,
    permissions,
    acknowledgement,
  };
}
