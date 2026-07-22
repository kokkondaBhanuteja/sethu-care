import { useId } from "react";
import { useTranslation } from "@sethu/i18n";
import { cn } from "@sethu/ui-web";

import { Button } from "../../components/ui/Button";
import { filterChipClassName } from "../../components/ui/FilterBar";
import { Sheet } from "../../components/ui/Sheet";
import type { BookingState } from "./bookings.constants";

export interface BookingsFilterSheetProps {
  isOpen: boolean;
  onDismiss: () => void;
  availableStates: readonly BookingState[];
  selectedStates: readonly BookingState[];
  onToggleState: (state: BookingState) => void;
  onClear: () => void;
}

/**
 * State narrowing for the current segment. Only the states the segment can actually contain are
 * offered — a filter that can only ever return nothing is worse than no filter, because the empty
 * result reads as a broken queue rather than an impossible question.
 *
 * The chip row is laid out here rather than through FilterBar: this sheet is a touch surface, so
 * the chips take the 44px tap floor (h-11) the shared 32px chip look does not carry, and the group
 * gets its visible "Booking state" caption. Promote a `size` variant to FilterBar when a second
 * touch consumer appears (standards Part 3.2).
 */
export function BookingsFilterSheet({
  isOpen,
  onDismiss,
  availableStates,
  selectedStates,
  onToggleState,
  onClear,
}: BookingsFilterSheetProps) {
  const { t } = useTranslation("adminBookings");
  const groupLabelId = useId();

  return (
    <Sheet
      isOpen={isOpen}
      title={t("filters.title")}
      onDismiss={onDismiss}
      footer={
        <>
          <Button variant="outline" size="secondary" onClick={onClear}>
            {t("filters.clear")}
          </Button>
          <Button variant="primary" size="secondary" block onClick={onDismiss}>
            {t("filters.apply")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-s3">
        <p id={groupLabelId} className="text-label font-medium text-text-2">
          {t("filters.stateGroup")}
        </p>
        <div role="group" aria-labelledby={groupLabelId} className="flex flex-wrap gap-s2">
          {availableStates.map((state) => {
            const isActive = selectedStates.includes(state);
            return (
              <button
                key={state}
                type="button"
                aria-pressed={isActive}
                // h-11 lifts the shared chip to the 44px touch floor (recorded px-token grid).
                className={cn(filterChipClassName(isActive), "h-11")}
                onClick={() => onToggleState(state)}
              >
                {t(`state.${state}`)}
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
