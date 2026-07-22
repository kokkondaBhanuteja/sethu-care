import { useId } from "react";
import { useTranslation } from "@sethu/i18n";
import {
  Combobox,
  FilterBand,
  FilterField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sethu/ui-web";

import { Card } from "../../../components/ui/Card";
import { SearchInput } from "../../../components/ui/SearchInput";
import {
  ROSTER_FILTER_ALL,
  ROSTER_STATUS_FILTER_ORDER,
  toRosterStatusFilter,
  type RosterFilterOptions,
  type RosterRefinements,
} from "../rosterFilters";
import { useProviderStatusLabel } from "./ProviderStatusIndicator";

export interface RosterFilterBandProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  refinements: RosterRefinements;
  onRefinementsChange: (next: RosterRefinements) => void;
  options: RosterFilterOptions;
}

/**
 * The labelled filter strip over the roster table (the Figma FilterBand pattern): search, a
 * searchable skill Combobox, and zone/status selects, each captioned so an operator never has to
 * guess what an unlabelled dropdown narrows. Filter state itself lives in `useProviderRoster`.
 */
export function RosterFilterBand({
  searchTerm,
  onSearchTermChange,
  refinements,
  onRefinementsChange,
  options,
}: RosterFilterBandProps) {
  const { t } = useTranslation("adminProviders");
  const statusLabelOf = useProviderStatusLabel();
  const zoneSelectId = useId();
  const statusSelectId = useId();

  const allLabel = t("roster.segmentAll");
  const skillOptions = options.skills.map((skill) => ({ value: skill, label: skill }));

  return (
    <Card>
      <FilterBand className="sm:grid-cols-2 xl:grid-cols-4">
        <FilterField label={t("roster.searchLabel")}>
          <SearchInput
            value={searchTerm}
            onValueChange={onSearchTermChange}
            placeholder={t("roster.searchPlaceholder")}
            label={t("roster.searchLabel")}
          />
        </FilterField>

        <FilterField label={t("roster.columnSkills")}>
          <Combobox
            options={skillOptions}
            value={refinements.skill === ROSTER_FILTER_ALL ? null : refinements.skill}
            onChange={(skill) =>
              onRefinementsChange({ ...refinements, skill: skill ?? ROSTER_FILTER_ALL })
            }
            placeholder={allLabel}
            searchPlaceholder={t("roster.filter")}
            emptyText={t("roster.filteredEmptyTitle")}
          />
        </FilterField>

        <FilterField label={t("roster.columnZone")} htmlFor={zoneSelectId}>
          <Select
            value={refinements.zone}
            onValueChange={(zone) => onRefinementsChange({ ...refinements, zone })}
          >
            <SelectTrigger id={zoneSelectId} size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROSTER_FILTER_ALL}>{allLabel}</SelectItem>
              {options.zones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label={t("roster.columnStatus")} htmlFor={statusSelectId}>
          <Select
            value={refinements.status}
            onValueChange={(status) =>
              onRefinementsChange({ ...refinements, status: toRosterStatusFilter(status) })
            }
          >
            <SelectTrigger id={statusSelectId} size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROSTER_FILTER_ALL}>{allLabel}</SelectItem>
              {ROSTER_STATUS_FILTER_ORDER.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabelOf(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBand>
    </Card>
  );
}
