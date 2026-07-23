// The only boundary between the bookings feature and its data.
//
// `GET /ops/bookings` and `GET /ops/bookings/{id}` are real (backend commit 6543b30) and served
// through the generated client when mocks are off; the mock branch is untouched, so unit tests and
// e2e runs behave exactly as before. No component, hook or type above this file changed in the
// flip — which is the whole point of this boundary.

import { opsGetBooking, opsListBookings } from "@sethu/api-client";

import { env } from "../../lib/env";
import { normalizeError } from "../../lib/http/apiError";
import { mapBookingDetail, mapBookingsPage, toListBookingsParams } from "./bookings.api.map";
import { fetchBookingDetailMock, fetchBookingsMock } from "./bookings.mock";
import type { BookingDetail, BookingsPage, BookingsQuery } from "./bookings.types";

export async function fetchBookings(
  query: BookingsQuery,
  signal?: AbortSignal,
): Promise<BookingsPage> {
  try {
    if (env.useMocks) return await fetchBookingsMock(query, signal);

    const result = await opsListBookings({ query: toListBookingsParams(query), signal });
    if (result.data === undefined) throw result.response;
    return mapBookingsPage(result.data);
  } catch (thrown) {
    throw normalizeError(thrown, "Bookings could not be loaded.");
  }
}

export async function fetchBookingDetail(
  bookingId: string,
  signal?: AbortSignal,
): Promise<BookingDetail> {
  try {
    if (env.useMocks) return await fetchBookingDetailMock(bookingId, signal);

    // The route param is the raw booking id; the "#B-…" reference is display-only (phase-1 note).
    const result = await opsGetBooking({ path: { id: bookingId }, signal });
    if (result.data === undefined) throw result.response;
    return mapBookingDetail(result.data);
  } catch (thrown) {
    throw normalizeError(thrown, "This booking could not be loaded.");
  }
}
