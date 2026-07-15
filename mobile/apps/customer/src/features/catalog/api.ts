import { useQuery } from "@tanstack/react-query";
import { listServicesOptions } from "@sethu/api-client";

// The public catalog. Uses the generated TanStack Query options straight from the contract — the
// query key, fetcher, and types are all in lockstep with the backend.
export function useServices() {
  return useQuery(listServicesOptions());
}
