import { useQuery } from "@tanstack/react-query";
import { myCashPositionOptions } from "@sethu/api-client";

// The technician's own cash standing: collected, deposited, and still outstanding. Drives the
// "cash to deposit" reminder on the job list.
export function useMyCash() {
  return useQuery(myCashPositionOptions());
}
