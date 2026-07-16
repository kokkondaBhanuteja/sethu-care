import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listMyJobsOptions,
  listMyJobsQueryKey,
  transitionBookingMutation,
} from "@sethu/api-client";

// The technician's assigned jobs. Polls every 5s so a newly-assigned job (or a customer-side
// change) shows without a manual refresh.
export function useMyJobs() {
  return useQuery({
    ...listMyJobsOptions(),
    refetchInterval: 5000,
  });
}

// Apply a state-machine action to a job (DEPART, ARRIVE, VERIFY_START, …). VERIFY_START and
// VERIFY_COMPLETION carry the customer's OTP code (and, on completion, the payment method) in the
// body — the backend runs the code check and the state change in one transaction. On success we
// refetch the job list so the new state and its allowed actions are reflected immediately.
export function useTransitionJob() {
  const queryClient = useQueryClient();
  return useMutation({
    ...transitionBookingMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listMyJobsQueryKey() });
    },
  });
}
