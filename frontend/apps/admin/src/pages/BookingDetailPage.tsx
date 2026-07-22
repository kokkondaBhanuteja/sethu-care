import { useParams } from "react-router";

import { useIsDesktop } from "../hooks/useBreakpoint";
import { BookingDetailScreen } from "../features/bookings/BookingDetailScreen";
import { BookingNotFound } from "../features/bookings/BookingNotFound";

/** Route target for `/bookings/:bookingId` (spec §6.9). */
export default function BookingDetailPage() {
  const { bookingId } = useParams<"bookingId">();
  const isDesktop = useIsDesktop();

  // A malformed deep link is a dead record, not a crash (spec §3.4 rule 3).
  if (!bookingId) return <BookingNotFound />;

  return <BookingDetailScreen bookingId={bookingId} isDesktop={isDesktop} />;
}
