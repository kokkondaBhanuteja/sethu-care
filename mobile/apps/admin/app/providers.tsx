"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureApiClient } from "@sethu/api-client";

import { API_BASE_URL } from "@/lib/config";
import { getSessionToken } from "@/lib/session";

// One-time client config (module scope): point the generated client at the backend and attach the
// admin token to every request.
configureApiClient({ baseUrl: API_BASE_URL, getToken: getSessionToken });

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: false } },
      }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
