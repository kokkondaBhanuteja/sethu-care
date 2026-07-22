import { useQuery } from "@tanstack/react-query";

import { fetchBookingDetail } from "./bookings.api";
import { BOOKING_QUERY_KEYS } from "./bookings.constants";
import type { BookingDetail } from "./bookings.types";

export interface BookingPreview {
  readonly detail: BookingDetail | undefined;
  readonly isLoading: boolean;
}

/**
 * The record behind the desktop preview pane. It shares `BOOKING_QUERY_KEYS.detail`, so opening the
 * full detail after previewing a booking renders from cache and the transition costs no round trip.
 */
export function useBookingPreview(bookingId: string | null): BookingPreview {
  const query = useQuery({
    queryKey: BOOKING_QUERY_KEYS.detail(bookingId ?? ""),
    queryFn: ({ signal }) => fetchBookingDetail(bookingId ?? "", signal),
    enabled: bookingId !== null,
    retry: false,
  });

  return {
    detail: bookingId === null ? undefined : query.data,
    isLoading: bookingId !== null && query.isPending,
  };
}
