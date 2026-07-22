import { useTranslation } from "@sethu/i18n";

import { cx } from "../../lib/cx";
import { filterChipClassName } from "../../components/ui/FilterBar";
import { ATTENTION_FILTER_ORDER } from "./dashboard.constants";
import { ATTENTION_FILTERS, type AttentionFilter, type AttentionQueue } from "./dashboard.types";

export interface AttentionFiltersProps {
  value: AttentionFilter;
  counts: AttentionQueue["counts"];
  onChange: (filter: AttentionFilter) => void;
  /** Inside `.main` the 24px page padding is already applied, so the row runs flush. */
  flush?: boolean;
  children?: React.ReactNode;
}

const LABEL_KEYS = {
  all: "filters.all",
  escalated: "filters.escalated",
  unassigned: "filters.unassigned",
  sla: "filters.sla",
  delayed: "filters.delayed",
  no_response: "filters.noResponse",
} as const satisfies Readonly<Record<AttentionFilter, string>>;

/**
 * The chips carry their counts so the manager can see the shape of the queue without applying one —
 * "All" included, so the arithmetic across the chips is checkable at a glance (UX audit). A chip
 * whose count is zero is disabled rather than hidden: the zero is evidence, not decoration, and a
 * chip that disappears takes the evidence with it.
 */
export function AttentionFilters({
  value,
  counts,
  onChange,
  flush = false,
  children,
}: AttentionFiltersProps) {
  const { t } = useTranslation("adminDashboard");

  return (
    <div
      role="group"
      aria-label={t("filters.label")}
      className={cx(
        // P3 restyle: the chip row is token utilities; it scrolls sideways rather than wrapping.
        "flex items-center gap-2 overflow-x-auto px-4 py-3",
        flush && "px-0",
      )}
    >
      {ATTENTION_FILTER_ORDER.map((filter) => {
        const count = counts[filter];
        const isEmptyGroup = filter !== ATTENTION_FILTERS.all && count === 0;
        return (
          <button
            key={filter}
            type="button"
            aria-pressed={filter === value}
            disabled={isEmptyGroup && filter !== value}
            className={filterChipClassName(filter === value)}
            onClick={() => onChange(filter)}
          >
            {t(LABEL_KEYS[filter], { count })}
          </button>
        );
      })}
      {children ? <div className="grow flex justify-end">{children}</div> : null}
    </div>
  );
}
