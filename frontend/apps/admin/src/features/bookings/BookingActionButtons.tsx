import { useNavigate } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Button, type ButtonSize, type ButtonVariant } from "../../components/ui/Button";
import { BOOKING_ACTION_IDS, type BookingActionDescriptor } from "./useBookingActions";

export interface BookingActionButtonsProps {
  actions: readonly BookingActionDescriptor[];
  size?: ButtonSize;
  block?: boolean;
  /**
   * Every write path on the screen goes inert together — stale record, or offline. Buttons grey out
   * rather than disappearing: the operator must be able to see what they were about to press and
   * understand why it is no longer theirs to press. A vanished button reads as a rendering fault.
   */
  isDisabled?: boolean;
  /** The one action this state is usually opened to perform (spec §6.9) renders filled. */
  primaryActionId?: string;
}

const DESTRUCTIVE_VARIANT: Readonly<Partial<Record<string, ButtonVariant>>> = {
  [BOOKING_ACTION_IDS.cancel]: "outlineDanger",
};

/**
 * Navigation only. Assign, cancel, re-dispatch, manual completion and refund are owned by
 * features/booking-actions; this feature decides which of them the record's state and the operator's
 * permissions allow, and routes there.
 */
export function BookingActionButtons({
  actions,
  size = "section",
  block = false,
  isDisabled = false,
  primaryActionId,
}: BookingActionButtonsProps) {
  const { t } = useTranslation("adminBookings");
  const navigate = useNavigate();

  return (
    <>
      {actions.map((action) => (
        <Button
          key={action.id}
          variant={
            action.id === primaryActionId
              ? "primary"
              : (DESTRUCTIVE_VARIANT[action.id] ?? "outline")
          }
          size={size}
          block={block}
          disabled={isDisabled}
          onClick={() => void navigate(action.to)}
        >
          {t(`actions.${action.id}`)}
        </Button>
      ))}
    </>
  );
}
