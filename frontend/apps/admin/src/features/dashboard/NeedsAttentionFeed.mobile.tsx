import { WifiOff } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Banner } from "../../components/ui/Banner";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { MobileAppBar } from "../../layouts/MobileAppBar";
import { MobileScroll } from "../../layouts/PageMain";
import { formatTime } from "../../lib/format";
import { AttentionAllClear, AttentionFilteredEmpty } from "./AttentionEmptyStates";
import { AttentionFilters } from "./AttentionFilters";
import { AttentionSkeleton } from "./DashboardSkeletons";
import { NeedsAttentionCards } from "./NeedsAttentionCards.mobile";
import { CONNECTION_STATUSES } from "./useConnectionStatus";
import { useNeedsAttention } from "./useNeedsAttention";

const SKELETON_ROWS = 4;
const CARD_SKELETON_HEIGHT = "h-row-72";
const NO_COUNTS = { all: 0, escalated: 0, unassigned: 0, sla: 0, delayed: 0 } as const;

/**
 * BOX 30 — the same records as the desktop table, rendered as stacked cards over the same
 * `useNeedsAttention()` hook. The age is deliberately quiet tertiary text rather than a sort key
 * the eye can mistake for one: the 34-minute unreachable provider sits above the 5-minute
 * unanswered call because it is worse, not because it is older.
 */
export function NeedsAttentionFeedMobile() {
  const { t } = useTranslation("adminDashboard");
  const attention = useNeedsAttention({ limit: null });
  const queue = attention.query.data;
  const isOffline = attention.connection === CONNECTION_STATUSES.offline;

  return (
    <>
      <MobileAppBar
        title={t("attention.title")}
        showBack
        actions={<span className="text-sm text-muted">{queue?.counts.all ?? 0}</span>}
      />

      {isOffline && queue ? (
        <Banner
          tone="warning"
          icon={WifiOff}
          sticky
          title={t("offline.banner", { time: formatTime(queue.updatedAt) })}
        />
      ) : null}

      <AttentionFilters
        value={attention.filter}
        counts={queue?.counts ?? NO_COUNTS}
        onChange={attention.setFilter}
      />

      <MobileScroll>
        <div className="px-4 pb-6 pt-1">
          <QueryBoundary
            query={attention.query}
            skeleton={<AttentionSkeleton rows={SKELETON_ROWS} rowHeight={CARD_SKELETON_HEIGHT} />}
            isEmpty={(data) => data.items.length === 0}
            grow
            // Filtered-empty is deliberately plainer than all-clear and carries no green: nothing
            // has been achieved, a filter is simply hiding live problems (spec §4.10).
            empty={
              attention.isFiltered ? (
                <AttentionFilteredEmpty
                  filter={attention.filter}
                  onClearFilters={attention.clearFilters}
                />
              ) : (
                <AttentionAllClear
                  healthyJobs={queue?.healthyJobs ?? 0}
                  lastCleared={queue?.lastCleared ?? null}
                />
              )
            }
          >
            {(data) => (
              <NeedsAttentionCards
                items={data.items}
                permissions={attention.permissions}
                isBlocked={attention.isActionBlocked}
                acknowledgement={attention.acknowledgement}
              />
            )}
          </QueryBoundary>
        </div>
      </MobileScroll>
    </>
  );
}
