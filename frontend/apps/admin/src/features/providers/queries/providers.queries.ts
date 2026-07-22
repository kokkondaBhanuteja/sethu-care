import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import {
  fetchProviderActiveJobs,
  fetchProviderProfile,
  fetchProviderRoster,
} from "../providers.api";
import { PROVIDER_QUERY_KEYS } from "../providers.constants";
import type { RosterVariant } from "../providers.mock";
import type { ProviderProfile, ProviderRoster, RosterSegment } from "../providers.types";
import type { ProviderActiveJob } from "../suspend.types";

/** Live statuses go stale fast — a "Free" from twenty minutes ago is a wrong answer (spec §6.15). */
const ROSTER_REFETCH_MS = 30_000;

export function useProviderRosterQuery(
  segment: RosterSegment,
  search: string,
  variant: RosterVariant,
): UseQueryResult<ProviderRoster> {
  return useQuery({
    queryKey: [...PROVIDER_QUERY_KEYS.roster(segment, search), variant],
    queryFn: ({ signal }) => fetchProviderRoster({ segment, search, variant }, signal),
    refetchInterval: ROSTER_REFETCH_MS,
  });
}

export function useProviderProfileQuery(
  providerId: string,
): UseQueryResult<ProviderProfile | null> {
  return useQuery({
    queryKey: PROVIDER_QUERY_KEYS.profile(providerId),
    queryFn: ({ signal }) => fetchProviderProfile(providerId, signal),
  });
}

export function useProviderActiveJobsQuery(
  providerId: string,
): UseQueryResult<readonly ProviderActiveJob[]> {
  return useQuery({
    queryKey: PROVIDER_QUERY_KEYS.activeJobs(providerId),
    queryFn: ({ signal }) => fetchProviderActiveJobs(providerId, signal),
  });
}
