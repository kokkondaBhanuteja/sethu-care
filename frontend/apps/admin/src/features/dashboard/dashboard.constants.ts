import { BellRing, Clock, Phone, UserX } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { PillTone } from "../../components/ui/Pill";
import { ROUTES } from "../../routes/routes.constants";
import {
  ATTENTION_ACTIONS,
  ATTENTION_FILTERS,
  ATTENTION_PRIORITIES,
  type AttentionAction,
  type AttentionFilter,
  type AttentionPriority,
  type DashboardPeriod,
} from "./dashboard.types";

export const DASHBOARD_QUERY_KEYS = {
  summary: (period: DashboardPeriod) => ["dashboard", "summary", period] as const,
  band: () => ["dashboard", "band"] as const,
  // The limit is part of the key: desktop's column shows eight entries and mobile's ticker three,
  // so a shell change must not leave the wider surface rendering the narrower surface's cache.
  activity: (limit: number) => ["dashboard", "activity", limit] as const,
  attention: (filter: AttentionFilter, limit: number | null) =>
    ["dashboard", "attention", filter, limit] as const,
} as const;

/** The dashboard preview is the top of the queue, not a separate list (spec §6.5). */
export const DASHBOARD_ATTENTION_LIMIT = 3;
/** Desktop's wider canvas shows the whole first page of the same queue in its panel. */
export const DASHBOARD_ATTENTION_LIMIT_DESKTOP = 5;

/**
 * The feed reveals the queue a page at a time behind "Load more". Sized just under the ~30-row
 * virtualisation threshold (spec §2.4): a full first page is still one scannable scroll.
 */
export const ATTENTION_FEED_PAGE_SIZE = 25;

/** The query-string key the feed reads its filter from, so a deep link can land pre-filtered. */
export const ATTENTION_FILTER_PARAM = "filter";

/**
 * Where the alert band points: the queue pre-filtered to the escalations the band is counting.
 * Landing on "All" made the band's count and the queue's count look like a contradiction.
 */
export const ESCALATED_ATTENTION_LINK = `${ROUTES.liveAttention}?${ATTENTION_FILTER_PARAM}=${ATTENTION_FILTERS.escalated}`;

/** Polling stands in for the `admin:live` socket until `GET /ops/stream` exists. */
export const DASHBOARD_REFETCH_MS = 30_000;
export const ATTENTION_REFETCH_MS = 20_000;

/** Above this the band stops counting: "14, 13, 15" is a flicker, not information (spec §6.5). */
export const ALERT_BAND_CAP = 9;

/** A resolved row leaves over 240ms with a flash rather than vanishing under the thumb (§6.6). */
export const RESOLVE_ANIMATION_MS = 240;

/** Feed order: worst first, oldest first inside a tier. Never chronological (spec §6.6). */
export const ATTENTION_PRIORITY_ORDER: readonly AttentionPriority[] = [
  ATTENTION_PRIORITIES.escalated,
  ATTENTION_PRIORITIES.slaBreached,
  ATTENTION_PRIORITIES.failedAssignment,
  ATTENTION_PRIORITIES.slaRisk,
  ATTENTION_PRIORITIES.noResponse,
  ATTENTION_PRIORITIES.escalatedAcknowledged,
];

export const ATTENTION_FILTER_ORDER: readonly AttentionFilter[] = [
  ATTENTION_FILTERS.all,
  ATTENTION_FILTERS.escalated,
  ATTENTION_FILTERS.unassigned,
  ATTENTION_FILTERS.sla,
  ATTENTION_FILTERS.delayed,
  ATTENTION_FILTERS.noResponse,
];

export interface PriorityPresentation {
  readonly tone: PillTone;
  readonly icon: LucideIcon;
  /** The 3px severity edge marks escalation only: it means the automation has given up. */
  readonly severeEdge: boolean;
  readonly actions: readonly [AttentionAction, AttentionAction];
}

export const PRIORITY_PRESENTATION: Readonly<Record<AttentionPriority, PriorityPresentation>> = {
  [ATTENTION_PRIORITIES.escalated]: {
    tone: "danger",
    icon: BellRing,
    severeEdge: true,
    actions: [ATTENTION_ACTIONS.acknowledge, ATTENTION_ACTIONS.assign],
  },
  [ATTENTION_PRIORITIES.escalatedAcknowledged]: {
    tone: "danger",
    icon: BellRing,
    severeEdge: true,
    actions: [ATTENTION_ACTIONS.call, ATTENTION_ACTIONS.assign],
  },
  [ATTENTION_PRIORITIES.slaBreached]: {
    tone: "danger",
    icon: Clock,
    severeEdge: false,
    actions: [ATTENTION_ACTIONS.call, ATTENTION_ACTIONS.cancel],
  },
  [ATTENTION_PRIORITIES.failedAssignment]: {
    tone: "danger",
    icon: UserX,
    severeEdge: false,
    actions: [ATTENTION_ACTIONS.assign, ATTENTION_ACTIONS.redispatch],
  },
  [ATTENTION_PRIORITIES.slaRisk]: {
    tone: "warning",
    // The same clock as a breach, in amber: the difference is how far gone it is, not what it is.
    icon: Clock,
    severeEdge: false,
    actions: [ATTENTION_ACTIONS.call, ATTENTION_ACTIONS.reassign],
  },
  [ATTENTION_PRIORITIES.noResponse]: {
    tone: "warning",
    icon: Phone,
    severeEdge: false,
    actions: [ATTENTION_ACTIONS.call, ATTENTION_ACTIONS.redispatch],
  },
};
