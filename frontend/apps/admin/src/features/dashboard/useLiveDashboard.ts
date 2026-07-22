import { useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { fetchActivity, fetchAlertBand, fetchDashboardSummary } from "./dashboard.api";
import { DASHBOARD_QUERY_KEYS, DASHBOARD_REFETCH_MS } from "./dashboard.constants";
import {
  DASHBOARD_PERIODS,
  type ActivityEntry,
  type AlertBandState,
  type DashboardPeriod,
  type DashboardSummary,
} from "./dashboard.types";
import { useConnectionStatus, type ConnectionStatus } from "./useConnectionStatus";

export interface LiveDashboardOptions {
  /** Desktop's right column shows eight entries; mobile's ticker shows three. */
  readonly activityLimit: number;
}

export interface LiveDashboardController {
  readonly period: DashboardPeriod;
  setPeriod: (period: DashboardPeriod) => void;
  readonly summaryQuery: UseQueryResult<DashboardSummary>;
  readonly bandQuery: UseQueryResult<AlertBandState>;
  readonly activityQuery: UseQueryResult<readonly ActivityEntry[]>;
  readonly connection: ConnectionStatus;
  /** The instant the figures on screen describe — the offline strip states it out loud. */
  readonly dataAsOf: string | null;
}

/**
 * Shared behaviour for the desktop and mobile dashboards (spec §6.5).
 *
 * The band is a query of its own rather than a slice of the summary, and deliberately so: alerts
 * arrive on their own push channel, so an escalation must not wait for a slow metrics query to
 * render. That is also why the loading state skeletonises the tiles but not the band.
 */
export function useLiveDashboard({ activityLimit }: LiveDashboardOptions): LiveDashboardController {
  const [period, setPeriod] = useState<DashboardPeriod>(DASHBOARD_PERIODS.today);

  const summaryQuery = useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.summary(period),
    queryFn: ({ signal }) => fetchDashboardSummary(period, signal),
    refetchInterval: DASHBOARD_REFETCH_MS,
  });

  const bandQuery = useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.band(),
    queryFn: ({ signal }) => fetchAlertBand(signal),
    refetchInterval: DASHBOARD_REFETCH_MS,
  });

  const activityQuery = useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.activity(activityLimit),
    queryFn: ({ signal }) => fetchActivity(activityLimit, signal),
    refetchInterval: DASHBOARD_REFETCH_MS,
  });

  const connection = useConnectionStatus({ failureCount: summaryQuery.failureCount });

  return {
    period,
    setPeriod,
    summaryQuery,
    bandQuery,
    activityQuery,
    connection,
    dataAsOf: summaryQuery.data?.updatedAt ?? null,
  };
}
