import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createBookingMutation, listMyBookingsQueryKey } from "@sethu/api-client";

// The booking action, made to feel instant. The classic TanStack optimistic lifecycle: cancel any
// in-flight my-bookings refetch, snapshot the cache, and reconcile on settle — so the UI can react
// before the network resolves and self-heals if the server rejects. (The confirmation screen shows
// the created booking immediately; the my-bookings list is invalidated to pick it up.)
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
