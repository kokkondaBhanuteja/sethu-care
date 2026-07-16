import { useQuery } from "@tanstack/react-query";
import { technicianLocationOptions } from "@sethu/api-client";

// The assigned technician's live location for a booking. Polls every 5s while enabled (the booking
// is EN_ROUTE / ARRIVED) so the marker moves as the technician approaches; `available` is false
// until the technician starts sharing.
export function useTechnicianLocation(bookingId: string, enabled: boolean) {
  return useQuery({
    ...technicianLocationOptions({ path: { id: bookingId } }),
    enabled: enabled && bookingId.length > 0,
    refetchInterval: enabled ? 5000 : false,
  });
}
