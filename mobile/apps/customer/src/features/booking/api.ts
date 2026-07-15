import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBookingMutation,
  getBookingOptions,
  getBookingQueryKey,
  listMyBookingsOptions,
  listMyBookingsQueryKey,
  transitionBookingMutation,
} from "@sethu/api-client";

const TERMINAL_STATES = new Set(["COMPLETED", "CANCELLED", "FAILED"]);

// The booking action, made to feel instant. The classic TanStack optimistic lifecycle: cancel any
// in-flight my-bookings refetch, snapshot the cache, and reconcile on settle — so the UI can react
// before the network resolves and self-heals if the server rejects.
export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    ...createBookingMutation(),
    onMutate: async () => {
      const key = listMyBookingsQueryKey();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      return { key, previous };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context) {
        void queryClient.invalidateQueries({ queryKey: context.key });
      }
    },
  });
}

// The customer's booking history.
export function useMyBookings() {
  return useQuery(listMyBookingsOptions());
}

// A single booking with LIVE status: it polls every 4s so the state updates on screen as the
// backend advances it, and stops polling once the booking reaches a terminal state.
export function useBooking(id: string) {
  return useQuery({
    ...getBookingOptions({ path: { id } }),
    enabled: id.length > 0,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state && TERMINAL_STATES.has(state) ? false : 4000;
    },
  });
}

// Apply a state-machine action to a booking (CONFIRM, CANCEL, …); refreshes the booking + history
// so the new state shows immediately.
export function useTransitionBooking(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...transitionBookingMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getBookingQueryKey({ path: { id } }) });
      void queryClient.invalidateQueries({ queryKey: listMyBookingsQueryKey() });
    },
  });
}
