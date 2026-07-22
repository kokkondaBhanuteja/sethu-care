// The only boundary between the bookings feature and its data.
//
// `GET /ops/bookings` and `GET /ops/bookings/{id}` do not exist on the backend yet — they are
// listed as MISSING in docs/admin-api-contract.md. When they land, the generated client's calls
// replace the mock calls below and no component, hook or type above this file changes.

import { normalizeError } from "../../lib/http/apiError";
import { fetchBookingDetailMock, fetchBookingsMock } from "./bookings.mock";
import type { BookingDetail, BookingsPage, BookingsQuery } from "./bookings.types";

export async function fetchBookings(
  query: BookingsQuery,
  signal?: AbortSignal,
): Promise<BookingsPage> {
  try {
    return await fetchBookingsMock(query, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "Bookings could not be loaded.");
  }
}

export async function fetchBookingDetail(
  bookingId: string,
  signal?: AbortSignal,
): Promise<BookingDetail> {
  try {
    return await fetchBookingDetailMock(bookingId, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "This booking could not be loaded.");
  }
}
