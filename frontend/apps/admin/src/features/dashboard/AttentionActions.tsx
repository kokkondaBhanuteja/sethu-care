import { Phone } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Button, type ButtonVariant } from "../../components/ui/Button";
import { ROUTES } from "../../routes/routes.constants";
import { PRIORITY_PRESENTATION } from "./dashboard.constants";
import { ATTENTION_ACTIONS, type AttentionAction, type AttentionItem } from "./dashboard.types";
import type { AttentionPermissions } from "./useNeedsAttention";

export interface AttentionActionsProps {
  item: AttentionItem;
  permissions: AttentionPermissions;
  /** Offline: the buttons stay visible and disabled with a stated reason (spec §4.10). */
  isBlocked: boolean;
  onAcknowledge: () => void;
  /** Mobile promotes Acknowledge to the filled button; the desktop table keeps both outline. */
  emphasiseAcknowledge?: boolean;
}

const PERMISSION_OF: Readonly<Record<AttentionAction, keyof AttentionPermissions>> = {
  acknowledge: "acknowledge",
  assign: "assign",
  call: "call",
  cancel: "cancel",
  reassign: "assign",
  redispatch: "redispatch",
};

const LABEL_KEYS = {
  acknowledge: "actions.acknowledge",
  assign: "actions.assign",
  call: "actions.call",
  cancel: "actions.cancel",
  reassign: "actions.reassign",
  redispatch: "actions.redispatch",
} as const satisfies Readonly<Record<AttentionAction, string>>;

/**
 * The two inline buttons a queue row offers. The reason decides which two, not the booking state —
 * the reason column is the diagnosis, and it is what decides which button the manager reaches for.
 *
 * Assign, Reassign, Cancel and Re-dispatch are OWNED BY `features/booking-actions`: this component
 * only routes to them. Acknowledge is the one mutation the queue performs itself.
 */
export function AttentionActions({
  item,
  permissions,
  isBlocked,
  onAcknowledge,
  emphasiseAcknowledge = false,
}: AttentionActionsProps) {
  const { t } = useTranslation("adminDashboard");
  const navigate = useNavigate();

  const run = (action: AttentionAction) => {
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
  };

  return (
    <div className="flex gap-s2">
      {PRIORITY_PRESENTATION[item.priority].actions.map((action) => {
        const label = t(LABEL_KEYS[action]);
        const disabled = isBlocked || !permissions[PERMISSION_OF[action]];
        const reason = isBlocked ? t("actions.offlineReason") : t("actions.noPermission");

        return (
          <Button
            key={action}
            size="inline"
            variant={variantFor(action, emphasiseAcknowledge)}
            disabled={disabled}
            title={disabled ? reason : undefined}
            aria-label={disabled ? `${label} — ${reason}` : undefined}
            iconStart={action === ATTENTION_ACTIONS.call ? Phone : undefined}
            onClick={() => run(action)}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}

function variantFor(action: AttentionAction, emphasise: boolean): ButtonVariant {
  if (!emphasise) return "outline";
  if (action === ATTENTION_ACTIONS.acknowledge) return "primary";
  if (action === ATTENTION_ACTIONS.cancel) return "outlineDanger";
  return "outline";
}
