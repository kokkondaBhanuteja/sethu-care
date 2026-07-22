import { FilterX } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../Button";
import { EmptyState } from "../EmptyState";

export interface FilteredEmptyStateProps {
  onClearFilters: () => void;
  grow?: boolean;
}

/**
 * "No results for these filters" — deliberately distinct from a genuinely empty list (spec §4.10).
 * Showing "Nothing here yet" when a filter is hiding forty rows is how an operator concludes the
 * system is broken.
 */
export function FilteredEmptyState({ onClearFilters, grow = false }: FilteredEmptyStateProps) {
  const { t } = useTranslation("adminShell");

  return (
    <EmptyState
      icon={FilterX}
      title={t("state.filteredEmptyTitle")}
      body={t("state.filteredEmptyBody")}
      grow={grow}
      actions={
        <Button variant="outline" size="secondary" block onClick={onClearFilters}>
          {t("state.clearFilters")}
        </Button>
      }
    />
  );
}
