import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { fetchApplicationQueue, fetchApplicationReview } from "../applications.api";
import { PROVIDER_QUERY_KEYS } from "../providers.constants";
import type {
  ApplicationQueue,
  ApplicationReview,
  ApplicationSegment,
} from "../applications.types";

export function useApplicationQueueQuery(
  segment: ApplicationSegment,
  includeDecided: boolean,
): UseQueryResult<ApplicationQueue> {
  return useQuery({
    queryKey: [...PROVIDER_QUERY_KEYS.applications(segment), includeDecided],
    queryFn: ({ signal }) => fetchApplicationQueue({ segment, includeDecided }, signal),
  });
}

export function useApplicationReviewQuery(
  applicationId: string,
): UseQueryResult<ApplicationReview | null> {
  return useQuery({
    queryKey: PROVIDER_QUERY_KEYS.application(applicationId),
    queryFn: ({ signal }) => fetchApplicationReview(applicationId, signal),
  });
}
