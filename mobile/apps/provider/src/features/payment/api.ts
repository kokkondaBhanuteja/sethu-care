import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  depositCashMutation,
  getPaymentOptions,
  getPaymentQueryKey,
  listMyJobsQueryKey,
} from "@sethu/api-client";

// A booking's UPI collection (reference, amount, and the upi:// deep link while it is still
// PENDING). Only fetched once enabled — there is no collection to show before the job is completed
// with a UPI/ONLINE method. Polls while pending so the technician sees "paid" the moment the
// customer's payment is captured.
export function useBookingPayment(id: string, enabled: boolean) {
  return useQuery({
    ...getPaymentOptions({ path: { id } }),
    enabled: enabled && id.length > 0,
    refetchInterval: (query) => (query.state.data?.status === "PENDING" ? 4000 : false),
  });
}

// Deposit cash the technician collected for a booking. Writes the offsetting CASH_DEPOSIT entry;
// the backend guards that only the holder may deposit, and only once. Refreshes the job list.
export function useDepositCash() {
  const queryClient = useQueryClient();
  return useMutation({
    ...depositCashMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listMyJobsQueryKey() });
    },
  });
}

export { getPaymentQueryKey };
