// Pure mappers from the generated /ops dashboard payloads (@sethu/api-client) onto this feature's
// normative shapes in dashboard.types.ts. The feature types are law: every field is copied
// explicitly so a contract drift is a compile error here, never a rendering surprise.

import type {
  ActivityFeed as ApiActivityFeed,
  AttentionFilter as ApiAttentionFilter,
  AttentionItem as ApiAttentionItem,
  AttentionQueue as ApiAttentionQueue,
  DashboardSummary as ApiDashboardSummary,
} from "@sethu/api-client";

import { ATTENTION_FILTERS, ATTENTION_PRIORITIES } from "./dashboard.types";
import type {
  ActivityEntry,
  AttentionFilter,
  AttentionItem,
  AttentionQueue,
  DashboardSummary,
} from "./dashboard.types";

/** The server caps page size at 100; "the whole queue" (limit null) asks for the cap. */
export const ATTENTION_FETCH_CAP = 100;

/**
 * The server's filter vocabulary has no `no_response` chip (its queue never emits that priority
 * today). The console keeps the chip so every priority stays reachable (UX audit) — it fetches
 * the unfiltered queue and narrows client-side in `mapAttentionQueue`.
 */
export function toServerAttentionFilter(filter: AttentionFilter): ApiAttentionFilter {
  return filter === ATTENTION_FILTERS.noResponse ? ATTENTION_FILTERS.all : filter;
}

/**
 * The diagnosis column as the feature renders it. The server sends numbers, not prose ("the
 * console localises it"); the console is English-only in practice (spec §4.7), so the sentence is
 * composed here as data — exactly as the mock fixtures carry it. When this feature grows a
 * localisation path for server data, this is the one function that moves behind it.
 */
export function attentionReason(item: ApiAttentionItem): string {
  const { declinedCount, dispatchRounds, minutesOverdue } = item.diagnosis;

  switch (item.priority) {
    case ATTENTION_PRIORITIES.escalated:
    case ATTENTION_PRIORITIES.escalatedAcknowledged:
    case ATTENTION_PRIORITIES.failedAssignment: {
      // A SEARCHING booking arrives as failed_assignment with zero rounds and declines.
      if (dispatchRounds !== null && dispatchRounds > 0) {
        const declineSuffix =
          declinedCount !== null && declinedCount > 0 ? `, ${declinedCount} declined` : "";
        return `No provider found after ${dispatchRounds} rounds${declineSuffix}`;
      }
      return "No provider found yet";
    }
    case ATTENTION_PRIORITIES.slaBreached:
      return minutesOverdue !== null
        ? `${minutesOverdue} min past the promised slot`
        : "Past the promised slot";
    case ATTENTION_PRIORITIES.slaRisk:
      return minutesOverdue !== null ? `Running ${minutesOverdue} min late` : "Running late";
    case ATTENTION_PRIORITIES.noResponse:
      return minutesOverdue !== null
        ? `No response for ${minutesOverdue} min`
        : "No response from the provider";
  }
}

export function mapAttentionItem(item: ApiAttentionItem): AttentionItem {
  return {
    alertId: item.alertId,
    bookingId: item.bookingId,
    bookingRef: item.bookingRef,
    priority: item.priority,
    service: item.service,
    customerName: item.customerName,
    area: item.area,
    reason: attentionReason(item),
    providerName: item.providerName,
    providerState: item.providerState,
    surfacedAt: item.surfacedAt,
    slotAt: item.slotAt,
    amountPaise: item.amountPaise,
    acknowledged: item.acknowledged,
  };
}

export function mapAttentionQueue(
  payload: ApiAttentionQueue,
  requestedFilter: AttentionFilter,
): AttentionQueue {
  const items = payload.items.map(mapAttentionItem);
  const noResponseItems = items.filter((item) => item.priority === ATTENTION_PRIORITIES.noResponse);

  return {
    items: requestedFilter === ATTENTION_FILTERS.noResponse ? noResponseItems : items,
    total: payload.total,
    counts: {
      all: payload.counts.all,
      escalated: payload.counts.escalated,
      unassigned: payload.counts.unassigned,
      sla: payload.counts.sla,
      delayed: payload.counts.delayed,
      // Not in the server's counts vocabulary — counted from the fetched rows. Honest whenever
      // the chip row renders (the full feed fetches the whole queue), and 0 today regardless:
      // the backend never emits the priority.
      no_response: noResponseItems.length,
    },
    lastCleared: payload.lastCleared
      ? {
          at: payload.lastCleared.at,
          bookingRef: payload.lastCleared.bookingRef,
          adminName: payload.lastCleared.adminName,
        }
      : null,
    healthyJobs: payload.healthyJobs,
    updatedAt: payload.updatedAt,
  };
}

export function mapDashboardSummary(payload: ApiDashboardSummary): DashboardSummary {
  return {
    bookings: payload.bookings,
    bookingsDelta: { value: payload.bookingsDelta.value, isGood: payload.bookingsDelta.isGood },
    revenuePaise: payload.revenuePaise,
    revenueDelta: { value: payload.revenueDelta.value, isGood: payload.revenueDelta.isGood },
    completionRate: payload.completionRate,
    completionDelta: {
      value: payload.completionDelta.value,
      isGood: payload.completionDelta.isGood,
    },
    avgAssignMs: payload.avgAssignMs,
    avgAssignDelta: { value: payload.avgAssignDelta.value, isGood: payload.avgAssignDelta.isGood },
    sparklines: {
      bookings: [...payload.sparklines.bookings],
      revenue: [...payload.sparklines.revenue],
      completion: [...payload.sparklines.completion],
      avgAssign: [...payload.sparklines.avgAssign],
    },
    updatedAt: payload.updatedAt,
  };
}

export function mapActivityFeed(payload: ApiActivityFeed): readonly ActivityEntry[] {
  return payload.items.map((entry) => ({
    id: entry.id,
    bookingRef: entry.bookingRef,
    kind: entry.kind,
    providerName: entry.providerName,
    at: entry.at,
  }));
}
