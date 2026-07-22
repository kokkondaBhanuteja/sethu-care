import { Link } from "react-router";

import { Card } from "../../components/ui/Card";
import { cx } from "../../lib/cx";
import { formatMoney, formatPhone, formatTime } from "../../lib/format";
import { ROUTES } from "../../routes/routes.constants";
import { BOOKING_STATE_PRESENTATION } from "./bookings.constants";
import { BookingStatePill } from "./BookingStatePill";
import { MatchHighlight, MonoText } from "./RecordText";
import { useBookingCopy } from "./useBookingCopy";
import type { BookingListItem } from "./bookings.types";

export interface BookingCardProps {
  booking: BookingListItem;
  /** When a search is running the phone line appears, with the matched digits marked in place. */
  search: string;
}

/**
 * One booking as a stacked card. The fourth line is the provider line and it is the only line that
 * changes colour: an ops manager scanning this list is really asking "who is on it, and are they
 * late?", so unassigned reads red while every healthy row stays secondary grey.
 */
export function BookingCard({ booking, search }: BookingCardProps) {
  const { providerLine } = useBookingCopy();
  const isUnassigned = booking.providerName === null;
  const edge = BOOKING_STATE_PRESENTATION[booking.state].rowTone === "danger" ? "danger" : "none";

  return (
    <Link to={ROUTES.bookingDetail(booking.id)} className="block">
      <Card edge={edge}>
        <div className="flex items-start justify-between gap-s2">
          <MonoText className="text-text-1">{booking.reference}</MonoText>
          <BookingStatePill state={booking.state} isAdminVerified={booking.isAdminVerified} />
        </div>

        <p className="text-emph text-text-1 mt-s2 break-words">
          {booking.serviceName} · {booking.customerName}
        </p>

        {search ? (
          <MonoText className="text-text-2 mt-s1 block">
            <MatchHighlight text={formatPhone(booking.customerPhone)} query={search} />
          </MonoText>
        ) : null}

        <p className="text-label text-text-2 mt-s1 break-words">
          {booking.area} · {formatTime(booking.slotAt)} · {formatMoney(booking.amountPaise)}
        </p>

        <p
          className={cx(
            "text-label mt-s1 break-words",
            isUnassigned ? "text-danger" : "text-text-2",
          )}
        >
          {providerLine(booking)}
        </p>
      </Card>
    </Link>
  );
}
