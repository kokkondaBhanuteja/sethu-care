import { useTranslation } from "@sethu/i18n";
import { cn } from "@sethu/ui-web";

import { filterChipClassName } from "../../components/ui/FilterBar";
import { severityChips, toSeverityFilter } from "./alerts.filters";
import type { SeverityFilter } from "./alerts.constants";
import type { Alert } from "./alerts.types";

export interface AlertSeverityChipsProps {
  alerts: readonly Alert[];
  activeFilter: SeverityFilter;
  onFilterChange: (filter: SeverityFilter) => void;
  className?: string;
}

/**
 * The severity filter as thumb-sized chips (mobile BOX 21): the shared chip look from FilterBar,
 * grown to the console's 44px tap-target floor. Mobile gets chips rather than the desktop band's
 * labelled Select because a filter an operator flicks between mid-incident must be one tap, not
 * open-choose-close. Counts come from the WHOLE feed, never the filtered view (alerts.filters).
 */
export function AlertSeverityChips({
  alerts,
  activeFilter,
  onFilterChange,
  className,
}: AlertSeverityChipsProps) {
  const { t } = useTranslation("adminAlerts");

  return (
    <div
      role="group"
      aria-label={t("filters.label")}
      className={cn("flex flex-wrap gap-s2", className)}
    >
      {severityChips(alerts, activeFilter, t).map((chip) => (
        <button
          key={chip.id}
          type="button"
          aria-pressed={chip.isActive}
          className={cn(filterChipClassName(chip.isActive), "min-h-tap-min")}
          onClick={() => onFilterChange(toSeverityFilter(chip.id))}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
