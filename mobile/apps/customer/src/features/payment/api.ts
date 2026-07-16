import { useQuery } from "@tanstack/react-query";
import { getPaymentOptions } from "@sethu/api-client";

// A booking's UPI collection for the customer to pay: reference, amount, and the upi:// deep link
// while it is still PENDING. Only fetched once enabled (the booking is completed) — a cash booking
// has no collection, so the query errors and the screen simply shows nothing (retry disabled to
// avoid hammering that 404). Polls while pending so "Paid" appears the moment it is captured.
export function useBookingPayment(id: string, enabled: boolean) {
  return useQuery({
    ...getPaymentOptions({ path: { id } }),
    enabled: enabled && id.length > 0,
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === "PENDING" ? 4000 : false),
  });
}
