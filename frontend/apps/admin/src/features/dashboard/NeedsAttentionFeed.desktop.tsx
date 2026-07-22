import { RefreshCw, WifiOff } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Banner } from "../../components/ui/Banner";
import { Icon } from "../../components/ui/Icon";
import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Topbar } from "../../layouts/Topbar";
import { formatTime } from "../../lib/format";
import { AttentionAllClear, AttentionFilteredEmpty } from "./AttentionEmptyStates";
import { AttentionFilters } from "./AttentionFilters";
import { ConnectionPill } from "./ConnectionPill";
import { AttentionSkeleton } from "./DashboardSkeletons";
import { NeedsAttentionTable } from "./NeedsAttentionTable.desktop";
import { CONNECTION_STATUSES } from "./useConnectionStatus";
import { useNeedsAttention } from "./useNeedsAttention";

const SKELETON_ROWS = 6;
const NO_COUNTS = { all: 0, escalated: 0, unassigned: 0, sla: 0, delayed: 0 } as const;

/**
 * BOX 18 — the screen an ops manager leaves open all shift. Ordered by PRIORITY, never by time; the
 * footer says so out loud, because a queue that looks chronological and is not will be misread once
 * and then distrusted forever.
 *
 * No auto-refresh countdown and no toast on update: the timestamp in the corner is enough, and rows
 * must not move under a pointer that is on its way to a button.
 */
export function NeedsAttentionFeedDesktop() {
  const { t } = useTranslation("adminDashboard");
  const attention = useNeedsAttention({ limit: null });
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

      <main className="main">
        <AttentionFilters
          value={attention.filter}
          counts={queue?.counts ?? NO_COUNTS}
          onChange={attention.setFilter}
          flush
        >
          <span className="flex items-center gap-s2 text-caption text-text-3">
            <Icon glyph={RefreshCw} size="sm" />
            {queue ? t("attention.refreshedAt", { time: formatTime(queue.updatedAt) }) : null}
          </span>
        </AttentionFilters>

        <QueryBoundary
          query={attention.query}
          skeleton={<AttentionSkeleton rows={SKELETON_ROWS} />}
          isEmpty={(data) => data.items.length === 0}
          grow
          // Empty-because-filtered is a DIFFERENT state, and the copy names the filter that is
          // hiding the rows — QueryBoundary's generic version cannot, so it is overridden here.
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
            <>
              <NeedsAttentionTable
                items={data.items}
                permissions={attention.permissions}
                isBlocked={attention.isActionBlocked}
                acknowledgement={attention.acknowledgement}
                variant="full"
              />
              {/* Says the ordering out loud: the two oldest items are not at the top, and the
                  manager must not read that as a bug. */}
              <p className="text-caption text-text-3 pt-s3 px-s2">
                {t("attention.orderNote", { shown: data.items.length, total: data.total })}
              </p>
            </>
          )}
        </QueryBoundary>
      </main>
    </>
  );
}
