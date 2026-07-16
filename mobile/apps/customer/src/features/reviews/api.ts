import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewBookingMutation, getBookingQueryKey } from "@sethu/api-client";

// Submit a rating + comment for a completed booking. The backend records it and emits a
// rating-recompute event for the technician. Refreshes the booking so the screen reflects that a
// review now exists.
export function useSubmitReview(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...reviewBookingMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getBookingQueryKey({ path: { id } }) });
    },
  });
}
