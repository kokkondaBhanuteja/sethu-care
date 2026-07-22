// The desktop chip row (BOX 13). Counts are of the whole feed, never of the filtered view.

import type { TFunction } from "i18next";

import type { FilterChip } from "../../components/ui/FilterBar";
import {
  SEVERITY_FILTER_ALL,
  SEVERITY_FILTER_LABEL_KEYS,
  SEVERITY_FILTER_ORDER,
  type SeverityFilter,
} from "./alerts.constants";
import { countBySeverity } from "./alerts.selectors";
import type { Alert } from "./alerts.types";

type AlertsTranslate = TFunction<"adminAlerts">;

export function severityChips(
  alerts: readonly Alert[],
  active: SeverityFilter,
  t: AlertsTranslate,
): readonly FilterChip[] {
  const counts = countBySeverity(alerts);

  return [
    { id: SEVERITY_FILTER_ALL, label: t("filters.all"), isActive: active === SEVERITY_FILTER_ALL },
    ...SEVERITY_FILTER_ORDER.map((severity) => ({
      id: severity,
      label: t(SEVERITY_FILTER_LABEL_KEYS[severity], { count: counts[severity] }),
      isActive: active === severity,
    })),
  ];
}

/** Narrows a chip id back to a filter without a cast — an unknown id falls back to "everything". */
export function toSeverityFilter(id: string): SeverityFilter {
  return SEVERITY_FILTER_ORDER.find((severity) => severity === id) ?? SEVERITY_FILTER_ALL;
}
