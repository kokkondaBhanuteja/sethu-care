import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { FilterBar } from "../../components/ui/FilterBar";
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

  const chips = availableStates.map((state) => ({
    id: state,
    label: t(`state.${state}`),
    isActive: selectedStates.includes(state),
  }));

  function handleToggle(id: string) {
    const match = availableStates.find((state) => state === id);
    if (match) onToggleState(match);
  }

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
      <FilterBar label={t("filters.stateGroup")} chips={chips} onToggle={handleToggle} />
    </Sheet>
  );
}
