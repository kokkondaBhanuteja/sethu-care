import { CircleCheck } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatTime } from "../../lib/format";
import { ATTENTION_FILTERS, type AttentionFilter, type AttentionQueue } from "./dashboard.types";

export interface AllClearProps {
  /** Counted instead of the zero: relief, not absence. */
  healthyJobs: number;
  lastCleared: AttentionQueue["lastCleared"];
  /** The dashboard panel uses the short "All clear"; the feed owns a whole screen. */
  compact?: boolean;
}

/**
 * A POSITIVE state, not an absence. The green check-circle replaces the usual grey empty glyph and
 * the body counts the jobs that ARE running instead of apologising for the zero — remove only the
 * cards and "everything is fine" and "the feed failed to load" look identical.
 */
export function AttentionAllClear({ healthyJobs, lastCleared, compact = false }: AllClearProps) {
  const { t } = useTranslation("adminDashboard");

  return (
    <div>
      <EmptyState
        icon={CircleCheck}
        positive
        title={compact ? t("attention.allClearShortTitle") : t("attention.allClearTitle")}
        body={t("attention.allClearBody", { count: healthyJobs })}
      />
      {!compact && lastCleared ? (
        <p className="text-caption text-text-3 text-center mt-s2">
          {t("attention.lastCleared", {
            time: formatTime(lastCleared.at),
            booking: lastCleared.bookingRef,
            admin: lastCleared.adminName,
          })}
        </p>
      ) : null}
    </div>
  );
}

const FILTER_NAME_KEYS = {
  all: "filters.all",
  escalated: "filters.escalatedName",
  unassigned: "filters.unassignedName",
  sla: "filters.slaName",
  delayed: "filters.delayedName",
} as const satisfies Readonly<Record<AttentionFilter, string>>;

export interface FilteredEmptyProps {
  filter: AttentionFilter;
  onClearFilters: () => void;
}

/**
 * Deliberately plainer than the all-clear state, and with no green anywhere: nothing has been
 * achieved here — a filter is simply hiding live problems — so the screen offers the way back out
 * and nothing that could be mistaken for congratulation (spec §4.10).
 */
export function AttentionFilteredEmpty({ filter, onClearFilters }: FilteredEmptyProps) {
  const { t } = useTranslation("adminDashboard");
  const name = t(FILTER_NAME_KEYS[filter === ATTENTION_FILTERS.all ? "escalated" : filter]);

  return (
    <div className="flex flex-col items-center gap-s2 py-s8">
      <p className="text-card text-text-1">{t("attention.filteredEmptyTitle", { filter: name })}</p>
      <Button variant="textBrand" size="inline" onClick={onClearFilters}>
        {t("attention.clearFilters")}
      </Button>
    </div>
  );
}
