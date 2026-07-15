import { QueryClient } from "@tanstack/react-query";

// Tuned for a mobile app that must feel as fast as the backend: revisited screens paint from
// cache (staleTime), the cache lives long enough to matter (gcTime), and we don't refetch on the
// noisy window-focus event that only makes sense on web.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});
