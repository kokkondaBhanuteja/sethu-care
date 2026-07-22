import { useQuery } from "@tanstack/react-query";

import { fetchPayoutCycle } from "./settings.api";
import { SETTINGS_QUERY_KEYS } from "./settings.constants";

/**
 * The settlement cycle (spec §1.5). Desktop-only on purpose: a payout run is a batch process over a
 * ledger, not phone work, and the seven numeric columns it needs cannot be scanned at 390px.
 *
 * A cycle changes when it is run, not continuously, so this does not poll.
 */
export function usePayouts() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEYS.payouts,
    queryFn: ({ signal }) => fetchPayoutCycle(signal),
  });
}
