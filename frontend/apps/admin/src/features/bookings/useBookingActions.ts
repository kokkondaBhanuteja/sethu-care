import { useMemo } from "react";

import { ADMIN_ACTIONS } from "../../lib/permissions/actions";
import { useCan } from "../../lib/permissions/usePermission";
import { ROUTES } from "../../routes/routes.constants";
import { BOOKING_STATES, RESCUE_STATES, type BookingState } from "./bookings.constants";

export const BOOKING_ACTION_IDS = {
  assign: "assign",
  redispatch: "redispatch",
  cancel: "cancel",
  manualComplete: "manualComplete",
  refund: "refund",
} as const;

export type BookingActionId = (typeof BOOKING_ACTION_IDS)[keyof typeof BOOKING_ACTION_IDS];

export interface BookingActionDescriptor {
  readonly id: BookingActionId;
  /** Owned by features/booking-actions — this feature only navigates to it. */
  readonly to: string;
}

const CANCELLABLE_STATES: readonly BookingState[] = [
  BOOKING_STATES.draft,
  BOOKING_STATES.confirmed,
  BOOKING_STATES.searching,
  BOOKING_STATES.assigned,
  BOOKING_STATES.enRoute,
  BOOKING_STATES.arrived,
  BOOKING_STATES.escalated,
  BOOKING_STATES.rescheduled,
  BOOKING_STATES.failed,
];

const REDISPATCHABLE_STATES: readonly BookingState[] = [
  BOOKING_STATES.confirmed,
  BOOKING_STATES.searching,
  BOOKING_STATES.escalated,
  BOOKING_STATES.failed,
];

const REFUNDABLE_STATES: readonly BookingState[] = [
  BOOKING_STATES.completed,
  BOOKING_STATES.cancelled,
];

/**
 * Which actions a state permits (spec §4.3), as amended by docs/Booking-Workflow-Decisions.md:
 *
 * - **Assign only from ESCALATED or FAILED.** Dispatch is automated now, so an assign button on a
 *   healthy booking would invite a manual intervention the system does not need. This is why the
 *   artifacts' "Reassign" button on BOX 7/8 and M9/M10 is deliberately not reproduced.
 * - **No reschedule, anywhere.** D1 removed rescheduling from the product; there is no route.
 * - Cancel stops at IN_PROGRESS — a job under way is cancelled by ending it, not by unbooking it.
 */
const STATES_ALLOWING: Readonly<Record<BookingActionId, readonly BookingState[]>> = {
  [BOOKING_ACTION_IDS.assign]: RESCUE_STATES,
  [BOOKING_ACTION_IDS.redispatch]: REDISPATCHABLE_STATES,
  [BOOKING_ACTION_IDS.cancel]: CANCELLABLE_STATES,
  [BOOKING_ACTION_IDS.manualComplete]: [BOOKING_STATES.awaitingCompletion],
  [BOOKING_ACTION_IDS.refund]: REFUNDABLE_STATES,
};

/** Primary action per spec §6.9: the one thing this state is usually opened to do. */
const PRIMARY_ORDER: readonly BookingActionId[] = [
  BOOKING_ACTION_IDS.assign,
  BOOKING_ACTION_IDS.manualComplete,
  BOOKING_ACTION_IDS.refund,
];

export interface BookingActionSet {
  readonly all: readonly BookingActionDescriptor[];
  readonly primary: BookingActionDescriptor | null;
  readonly secondary: readonly BookingActionDescriptor[];
  /** Escalations are acknowledged in place, so the action never leaves the record. */
  readonly canAcknowledge: boolean;
}

/**
 * The action set for one booking: state legality first, then the permission gate. Every entry is a
 * route owned by features/booking-actions — this feature never performs a booking mutation itself.
 */
export function useBookingActions(bookingId: string, state: BookingState | null): BookingActionSet {
  const canAssign = useCan(ADMIN_ACTIONS.assignProvider);
  const canRedispatch = useCan(ADMIN_ACTIONS.redispatch);
  const canCancel = useCan(ADMIN_ACTIONS.cancelBooking);
  const canManualComplete = useCan(ADMIN_ACTIONS.manualComplete);
  const canRefund = useCan(ADMIN_ACTIONS.refund);
  const canAcknowledgeAlert = useCan(ADMIN_ACTIONS.acknowledgeAlert);

  return useMemo(() => {
    if (!state) {
      return { all: [], primary: null, secondary: [], canAcknowledge: false };
    }

    const permitted: Readonly<Record<BookingActionId, boolean>> = {
      [BOOKING_ACTION_IDS.assign]: canAssign,
      [BOOKING_ACTION_IDS.redispatch]: canRedispatch,
      [BOOKING_ACTION_IDS.cancel]: canCancel,
      [BOOKING_ACTION_IDS.manualComplete]: canManualComplete,
      [BOOKING_ACTION_IDS.refund]: canRefund,
    };

    const routeFor: Readonly<Record<BookingActionId, string>> = {
      [BOOKING_ACTION_IDS.assign]: ROUTES.bookingAssign(bookingId),
      [BOOKING_ACTION_IDS.redispatch]: ROUTES.bookingRedispatch(bookingId),
      [BOOKING_ACTION_IDS.cancel]: ROUTES.bookingCancel(bookingId),
      [BOOKING_ACTION_IDS.manualComplete]: ROUTES.bookingManualComplete(bookingId),
      [BOOKING_ACTION_IDS.refund]: ROUTES.bookingRefund(bookingId),
    };

    const all = Object.values(BOOKING_ACTION_IDS)
      .filter((id) => permitted[id] && STATES_ALLOWING[id].includes(state))
      .map((id) => ({ id, to: routeFor[id] }));

    const primaryId = PRIMARY_ORDER.find((id) => all.some((action) => action.id === id)) ?? null;
    const primary = all.find((action) => action.id === primaryId) ?? null;

    return {
      all,
      primary,
      secondary: all.filter((action) => action.id !== primaryId),
      canAcknowledge: canAcknowledgeAlert && state === BOOKING_STATES.escalated,
    };
  }, [
    bookingId,
    state,
    canAssign,
    canRedispatch,
    canCancel,
    canManualComplete,
    canRefund,
    canAcknowledgeAlert,
  ]);
}
