import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";

import { API_ERROR_CODES, normalizeError, type ApiError } from "../http/apiError";

/** Query keys live with their feature; these are the app-wide ones only. */
export const APP_QUERY_KEYS = {
  session: ["session"] as const,
} as const;

/**
 * Ops data is short-lived by nature — a booking's age and a provider's online status are wrong the
 * moment they are cached. 15s keeps a tab switch instant without ever showing a stale queue.
 */
const STALE_TIME_MS = 15_000;
const MAX_RETRIES = 2;

function shouldRetry(failureCount: number, thrown: unknown): boolean {
  const error = normalizeError(thrown, "Request failed.");
  if (!error.retryable) return false;
  // A 401 has already triggered sign-out in the client's response hook; retrying just delays the
  // redirect behind two more round trips.
  if (error.code === API_ERROR_CODES.unauthorized) return false;
  return failureCount < MAX_RETRIES;
}

export interface QueryClientHooks {
  /** Surfaced as a toast. Reads happen behind ErrorState, so only writes announce themselves. */
  onMutationError: (error: ApiError) => void;
}

export function createQueryClient({ onMutationError }: QueryClientHooks): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        retry: shouldRetry,
        // The queue must be right when an operator comes back to the tab.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        // Never silently repeat a mutation: this console cancels bookings and issues refunds.
        retry: false,
      },
    },
    queryCache: new QueryCache(),
    mutationCache: new MutationCache({
      onError: (thrown) => {
        onMutationError(normalizeError(thrown, "The action could not be completed."));
      },
    }),
  });
}
