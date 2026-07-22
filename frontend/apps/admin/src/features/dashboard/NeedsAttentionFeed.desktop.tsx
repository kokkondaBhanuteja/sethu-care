import { RefreshCw, WifiOff } from "lucide-react";
import { useTranslation } from "@sethu/i18n";
import { Card, CardFooter } from "@sethu/ui-web";

import { Banner } from "../../components/ui/Banner";
import { Icon } from "../../components/ui/Icon";
import { Pagination } from "../../components/ui/Pagination";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { PageMain } from "../../layouts/PageMain";
import { Topbar } from "../../layouts/Topbar";
import { formatTime } from "../../lib/format";
import { AttentionAllClear, AttentionFilteredEmpty } from "./AttentionEmptyStates";
import { AttentionFilters } from "./AttentionFilters";
import { ConnectionPill } from "./ConnectionPill";
import { AttentionSkeleton } from "./DashboardSkeletons";
import { NeedsAttentionTable } from "./NeedsAttentionTable.desktop";
import { ATTENTION_FEED_PAGE_SIZE } from "./dashboard.constants";
import { CONNECTION_STATUSES } from "./useConnectionStatus";
import { useNeedsAttention } from "./useNeedsAttention";

const SKELETON_ROWS = 6;
const NO_COUNTS = {
  all: 0,
  escalated: 0,
  unassigned: 0,
  sla: 0,
  delayed: 0,
  no_response: 0,
} as const;

/**
 * BOX 18 — the screen an ops manager leaves open all shift, now one composed Card: the counted
 * filter chips as its header band, the table under the inset column headers, and the ordering
 * note as the card's footer. Ordered by PRIORITY, never by time; the footer says so out loud,
 * because a queue that looks chronological and is not will be misread once and then distrusted
 * forever.
 *
 * No auto-refresh countdown and no toast on update: the timestamp in the corner is enough, and rows
 * must not move under a pointer that is on its way to a button.
 */
export function NeedsAttentionFeedDesktop() {
  const { t } = useTranslation("adminDashboard");
  const attention = useNeedsAttention({ limit: null, pageSize: ATTENTION_FEED_PAGE_SIZE });
  const queue = attention.query.data;
  const isOffline = attention.connection === CONNECTION_STATUSES.offline;

  return (
    <>
      <Topbar
        title={t("attention.title")}
        actions={<ConnectionPill status={attention.connection} />}
      />

      {isOffline && queue ? (
        <Banner
          tone="warning"
          icon={WifiOff}
          sticky
          className="banner--wide"
          title={t("offline.banner", { time: formatTime(queue.updatedAt) })}
        />
      ) : null}

      <PageMain>
        <Card className="overflow-hidden">
          <AttentionFilters
            value={attention.filter}
            counts={queue?.counts ?? NO_COUNTS}
            onChange={attention.setFilter}
          >
            <span className="flex items-center gap-2 text-xs text-faint">
              <Icon glyph={RefreshCw} size="sm" />
              {queue ? t("attention.refreshedAt", { time: formatTime(queue.updatedAt) }) : null}
            </span>
          </AttentionFilters>

          <QueryBoundary
            query={attention.query}
            skeleton={
              <div className="px-4 pb-4">
                <AttentionSkeleton rows={SKELETON_ROWS} />
              </div>
            }
            isEmpty={(data) => data.items.length === 0}
            // Empty-because-filtered is a DIFFERENT state, and the copy names the filter that is
            // hiding the rows — QueryBoundary's generic version cannot, so it is overridden here.
            empty={
              <div className="px-4 pb-6">
                {attention.isFiltered ? (
                  <AttentionFilteredEmpty
                    filter={attention.filter}
                    onClearFilters={attention.clearFilters}
                  />
                ) : (
                  <AttentionAllClear
                    healthyJobs={queue?.healthyJobs ?? 0}
                    lastCleared={queue?.lastCleared ?? null}
                  />
                )}
              </div>
            }
          >
            {(data) => {
              const visibleItems =
                attention.visibleCount === null
                  ? data.items
                  : data.items.slice(0, attention.visibleCount);
              return (
                <>
                  <NeedsAttentionTable
                    items={visibleItems}
                    permissions={attention.permissions}
                    isBlocked={attention.isActionBlocked}
                    acknowledgement={attention.acknowledgement}
                    variant="full"
                  />
                  {/* Says the ordering out loud: the two oldest items are not at the top, and the
                      manager must not read that as a bug. The count and Load more come from the
                      shared Pagination composite, so "Showing X of Y" is always reachable
                      arithmetic — never a total the screen offers no way to reach (UX audit). */}
                  <CardFooter className="block">
                    <Pagination
                      shown={visibleItems.length}
                      total={data.counts[attention.filter]}
                      subject={t("attention.orderedBySubject")}
                      onLoadMore={attention.loadMore}
                    />
                  </CardFooter>
                </>
              );
            }}
          </QueryBoundary>
        </Card>
      </PageMain>
    </>
  );
}
