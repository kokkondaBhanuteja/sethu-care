import { mockRead, mockWrite } from "../../mocks/mockTransport";
import { ATTENTION_PRIORITY_ORDER } from "./dashboard.constants";
import { attentionItems, EMPTY_QUEUE } from "./attention.fixtures";
import { activityEntries, BAND, EMPTY_BAND, EMPTY_SUMMARY, SUMMARY } from "./dashboard.fixtures";
import { ATTENTION_FILTERS, ATTENTION_PRIORITIES } from "./dashboard.types";
import type {
  ActivityEntry,
  AlertBandState,
  AttentionFilter,
  AttentionItem,
  AttentionQueue,
  DashboardPeriod,
  DashboardSummary,
} from "./dashboard.types";

// The mock service standing in for the dashboard endpoints listed in docs/admin-api-contract.md.
// Ordering and filtering live here rather than in the hook because the server owns them: when
// `GET /ops/dashboard/attention` lands, this file is deleted and nothing above it changes.

const FILTER_PREDICATES: Readonly<Record<AttentionFilter, (item: AttentionItem) => boolean>> = {
  [ATTENTION_FILTERS.all]: () => true,
  [ATTENTION_FILTERS.escalated]: (item) =>
    item.priority === ATTENTION_PRIORITIES.escalated ||
    item.priority === ATTENTION_PRIORITIES.escalatedAcknowledged,
  [ATTENTION_FILTERS.unassigned]: (item) => item.providerName === null,
  [ATTENTION_FILTERS.sla]: (item) => item.priority === ATTENTION_PRIORITIES.slaBreached,
  [ATTENTION_FILTERS.delayed]: (item) => item.priority === ATTENTION_PRIORITIES.slaRisk,
  [ATTENTION_FILTERS.noResponse]: (item) => item.priority === ATTENTION_PRIORITIES.noResponse,
};

/** Worst first; oldest first inside a tier (spec §6.6). Never chronological. */
function byPriorityThenAge(left: AttentionItem, right: AttentionItem): number {
  const tier =
    ATTENTION_PRIORITY_ORDER.indexOf(left.priority) -
    ATTENTION_PRIORITY_ORDER.indexOf(right.priority);
  if (tier !== 0) return tier;
  return Date.parse(left.surfacedAt) - Date.parse(right.surfacedAt);
}

function countsFor(all: readonly AttentionItem[]): AttentionQueue["counts"] {
  return {
    all: all.length,
    escalated: all.filter(FILTER_PREDICATES.escalated).length,
    unassigned: all.filter(FILTER_PREDICATES.unassigned).length,
    sla: all.filter(FILTER_PREDICATES.sla).length,
    delayed: all.filter(FILTER_PREDICATES.delayed).length,
    no_response: all.filter(FILTER_PREDICATES.no_response).length,
  };
}

export function fetchAttentionQueueMock(
  filter: AttentionFilter,
  limit: number | null,
  signal?: AbortSignal,
): Promise<AttentionQueue> {
  return mockRead(
    () => {
      const all = [...attentionItems()].sort(byPriorityThenAge);
      const matching = all.filter(FILTER_PREDICATES[filter]);
      return {
        items: limit === null ? matching : matching.slice(0, limit),
        // The queue total must equal what an unpaginated fetch returns: a phantom remainder gave
        // the feed "Showing 5 of 7" with no way to reach the other two (UX audit).
        total: all.length,
        counts: countsFor(all),
        lastCleared: null,
        healthyJobs: 42,
        updatedAt: new Date().toISOString(),
      };
    },
    { ...(signal ? { signal } : {}), emptyValue: EMPTY_QUEUE },
  );
}

export function fetchDashboardSummaryMock(
  _period: DashboardPeriod,
  signal?: AbortSignal,
): Promise<DashboardSummary> {
  return mockRead(() => SUMMARY, { ...(signal ? { signal } : {}), emptyValue: EMPTY_SUMMARY });
}

export function fetchAlertBandMock(signal?: AbortSignal): Promise<AlertBandState> {
  return mockRead(() => BAND, { ...(signal ? { signal } : {}), emptyValue: EMPTY_BAND });
}

const NO_ACTIVITY: readonly ActivityEntry[] = [];

export function fetchActivityMock(
  limit: number,
  signal?: AbortSignal,
): Promise<readonly ActivityEntry[]> {
  return mockRead(() => activityEntries().slice(0, limit), {
    ...(signal ? { signal } : {}),
    emptyValue: NO_ACTIVITY,
  });
}

/**
 * Acknowledgement is idempotent server-side, so the mock never rejects a repeat — two operators
 * acknowledging concurrently must not error (docs/admin-api-contract.md). It is audited but carries
 * no step-up and no undo (lib/permissions/actions — `alert.acknowledge`, low risk).
 */
export function acknowledgeAlertMock(
  alertId: string,
  signal?: AbortSignal,
): Promise<{ alertId: string }> {
  return mockWrite(() => ({ alertId }), { ...(signal ? { signal } : {}) });
}
