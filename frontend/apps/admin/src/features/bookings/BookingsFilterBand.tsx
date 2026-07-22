import { useId } from "react";
import { useTranslation } from "@sethu/i18n";
import {
  FilterBand,
  FilterField,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sethu/ui-web";

import { Button } from "../../components/ui/Button";
import type { BookingState } from "./bookings.constants";

export interface BookingsFilterBandProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  availableStates: readonly BookingState[];
  selectedStates: readonly BookingState[];
  onReplaceStates: (states: readonly BookingState[]) => void;
  isFiltered: boolean;
  onClear: () => void;
}

/**
 * The desktop labelled filter band (the reference's table-screen anatomy): caption-above-control
 * units on a responsive grid, with the reset action on the controls' baseline. Mobile keeps the
 * filter sheet instead — a band this wide has nowhere to live on a 390px frame.
 *
 * The Select is the quick single-state narrowing; the state column's caret filter on the table is
 * where multi-state selections are made, so the Select shows a value only while exactly one state
 * is selected and falls back to its placeholder otherwise.
 */
export function BookingsFilterBand({
  searchTerm,
  onSearchChange,
  availableStates,
  selectedStates,
  onReplaceStates,
  isFiltered,
  onClear,
}: BookingsFilterBandProps) {
  const { t } = useTranslation("adminBookings");
  const { t: translateShell } = useTranslation("adminShell");
  const searchFieldId = useId();
  const stateFieldId = useId();
  const singleSelectedState = selectedStates.length === 1 ? (selectedStates[0] ?? "") : "";

  return (
    // Four columns from the shell split up: search (2) + state + Clear share one baseline at every
    // desktop width — on the default 3-column lg grid the reset wrapped onto its own row at 1180.
    <FilterBand
      className="md:grid-cols-4 lg:grid-cols-4"
      actions={
        <Button variant="outline" size="section" disabled={!isFiltered} onClick={onClear}>
          {t("filters.clear")}
        </Button>
      }
    >
      <FilterField label={t("search.label")} htmlFor={searchFieldId} className="sm:col-span-2">
        <SearchInput
          id={searchFieldId}
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          onClear={() => onSearchChange("")}
          clearLabel={translateShell("actions.clear")}
          placeholder={t("search.placeholder")}
        />
      </FilterField>

      <FilterField label={t("filters.stateGroup")} htmlFor={stateFieldId}>
        <Select
          value={singleSelectedState}
          onValueChange={(value) => {
            const matchedState = availableStates.find((candidate) => candidate === value);
            if (matchedState) onReplaceStates([matchedState]);
          }}
        >
          {/* "All states", not the field label again — a placeholder that repeats its caption
              reads as a selection that was never made. */}
          <SelectTrigger id={stateFieldId}>
            <SelectValue placeholder={t("filters.allStates")} />
          </SelectTrigger>
          <SelectContent>
            {availableStates.map((state) => (
              <SelectItem key={state} value={state}>
                {t(`state.${state}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
    </FilterBand>
  );
}
