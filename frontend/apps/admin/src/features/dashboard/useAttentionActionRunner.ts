import { useCallback } from "react";
import { useNavigate } from "react-router";

import { ROUTES } from "../../routes/routes.constants";
import { ATTENTION_ACTIONS, type AttentionAction, type AttentionItem } from "./dashboard.types";
import type { AttentionPermissions } from "./useNeedsAttention";

/** Which permission gates each row action. Reassign rides on assign — same capability. */
export const ATTENTION_ACTION_PERMISSION: Readonly<
  Record<AttentionAction, keyof AttentionPermissions>
> = {
  acknowledge: "acknowledge",
  assign: "assign",
  call: "call",
  cancel: "cancel",
  reassign: "assign",
  redispatch: "redispatch",
};

export const ATTENTION_ACTION_LABEL_KEYS = {
  acknowledge: "actions.acknowledge",
  assign: "actions.assign",
  call: "actions.call",
  cancel: "actions.cancel",
  reassign: "actions.reassign",
  redispatch: "actions.redispatch",
} as const satisfies Readonly<Record<AttentionAction, string>>;

export interface AttentionActionRunnerInput {
  readonly item: AttentionItem;
  readonly onAcknowledge: () => void;
}

/**
 * Runs one row action, shared by the full two-button row and the compact primary+overflow row so
 * the same action can never behave differently between the feed and the dashboard panel.
 *
 * Assign, Reassign, Cancel and Re-dispatch are OWNED BY `features/booking-actions`: this only
 * routes to them. Acknowledge is the one mutation the queue performs itself.
 */
export function useAttentionActionRunner({
  item,
  onAcknowledge,
}: AttentionActionRunnerInput): (action: AttentionAction) => void {
  const navigate = useNavigate();

  return useCallback(
    (action: AttentionAction) => {
      switch (action) {
        case ATTENTION_ACTIONS.acknowledge:
          return onAcknowledge();
        case ATTENTION_ACTIONS.assign:
        case ATTENTION_ACTIONS.reassign:
          return void navigate(ROUTES.bookingAssign(item.bookingId));
        case ATTENTION_ACTIONS.cancel:
          return void navigate(ROUTES.bookingCancel(item.bookingId));
        case ATTENTION_ACTIONS.redispatch:
          return void navigate(ROUTES.bookingRedispatch(item.bookingId));
        case ATTENTION_ACTIONS.call:
          // Calling opens the record: the phone number belongs to the booking, and an operator who
          // dials without seeing who they are calling is the source of the wrong-customer call.
          return void navigate(ROUTES.bookingDetail(item.bookingId));
      }
    },
    [item.bookingId, navigate, onAcknowledge],
  );
}
