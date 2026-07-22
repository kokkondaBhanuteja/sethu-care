import { useIsDesktop } from "../hooks/useBreakpoint";
import { BookingsListDesktop } from "../features/bookings/BookingsList.desktop";
import { BookingsListMobile } from "../features/bookings/BookingsList.mobile";

/** Route target for `/bookings` (spec §6.8). Picks the shell variant; the feature does the rest. */
export default function BookingsListPage() {
  return useIsDesktop() ? <BookingsListDesktop /> : <BookingsListMobile />;
}
