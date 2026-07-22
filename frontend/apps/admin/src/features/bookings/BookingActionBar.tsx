import { useNavigate } from "react-router";
import { MoreHorizontal } from "lucide-react";
import { useTranslation } from "@sethu/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sethu/ui-web";

import { Button } from "../../components/ui/Button";
import { BookingActionButtons } from "./BookingActionButtons";
import { BOOKING_ACTION_IDS } from "./useBookingActions";
import type { BookingActionSet } from "./useBookingActions";

/** Figma #7's action-bar budget: secondaries beyond this fold into the overflow menu. */
const VISIBLE_SECONDARY_LIMIT = 2;

export interface BookingActionBarProps {
  actions: BookingActionSet;
  /** Stale record or offline: every write path goes inert together (spec §6.9). */
  isDisabled?: boolean;
}

/**
 * The record header's action bar: outline secondaries, ONE filled contextual primary, and an
 * overflow menu for the rest. Acknowledge is deliberately absent — an escalation is acknowledged
 * in place, inside the escalation notice, so the action never leaves its evidence.
 */
export function BookingActionBar({ actions, isDisabled = false }: BookingActionBarProps) {
  const { t } = useTranslation("adminBookings");
  const navigate = useNavigate();

  if (actions.all.length === 0) return null;

  const visibleSecondaries = actions.secondary.slice(0, VISIBLE_SECONDARY_LIMIT);
  const overflowActions = actions.secondary.slice(VISIBLE_SECONDARY_LIMIT);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <BookingActionButtons actions={visibleSecondaries} size="inline" isDisabled={isDisabled} />

      {overflowActions.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="inline"
              iconStart={MoreHorizontal}
              aria-label={t("detail.moreActions")}
              disabled={isDisabled}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {overflowActions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                tone={action.id === BOOKING_ACTION_IDS.cancel ? "destructive" : "default"}
                onSelect={() => void navigate(action.to)}
              >
                {t(`actions.${action.id}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {actions.primary ? (
        <BookingActionButtons
          actions={[actions.primary]}
          size="inline"
          isDisabled={isDisabled}
          primaryActionId={actions.primary.id}
        />
      ) : null}
    </div>
  );
}
