import { MapPin } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { EmptyState } from "../../components/ui/EmptyState";
import { FilteredEmptyState } from "../../components/ui/states/FilteredEmptyState";

export interface MapMarkersEmptyProps {
  isFiltered: boolean;
  onClearFilters: () => void;
}

/**
 * Nothing on the canvas. Deliberately two states: "no jobs are running" and "your layers or your
 * focused zone are hiding everything" are different problems, and showing the first when the second
 * is true is how an operator concludes the map is broken (spec §4.10).
 *
 * Note this is NOT the zero-providers-online state — that is a danger Banner over a working map,
 * because it is a business emergency rather than an absence of data (spec §6.7).
 */
export function MapMarkersEmpty({ isFiltered, onClearFilters }: MapMarkersEmptyProps) {
  const { t } = useTranslation("adminMap");

  if (isFiltered) return <FilteredEmptyState onClearFilters={onClearFilters} />;

  return <EmptyState icon={MapPin} title={t("empty.title")} body={t("empty.body")} />;
}
