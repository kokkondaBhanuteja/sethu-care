import { useTranslation } from "@sethu/i18n";

import { Pill } from "../../components/ui/Pill";
import {
  ADMIN_VERIFIED_ICON,
  BOOKING_STATE_PRESENTATION,
  type BookingState,
} from "./bookings.constants";

export interface BookingStatePillProps {
  state: BookingState;
  /** A completion an admin asserted rather than one the customer's OTP proved (spec §4.3). */
  isAdminVerified?: boolean;
  onTint?: boolean;
}

/**
 * The one place a booking state becomes a colour. The mapping is spec §4.3, held in
 * bookings.constants so the table cell, the mobile card, the preview panel and the detail header
 * cannot drift apart.
 *
 * An admin-verified completion keeps the green of a success — the customer got their service — but
 * carries the diagonal hatch, so a list of completions never hides which one was asserted rather
 * than proved. Colour alone would have erased exactly the distinction a dispute turns on.
 */
export function BookingStatePill({
  state,
  isAdminVerified = false,
  onTint = false,
}: BookingStatePillProps) {
  const { t } = useTranslation("adminBookings");
  const presentation = BOOKING_STATE_PRESENTATION[state];

  return (
    <Pill
      tone={presentation.tone}
      icon={isAdminVerified ? ADMIN_VERIFIED_ICON : presentation.icon}
      striped={isAdminVerified}
      onTint={onTint}
    >
      {isAdminVerified ? t("stateAdminVerified") : t(`state.${state}`)}
    </Pill>
  );
}
