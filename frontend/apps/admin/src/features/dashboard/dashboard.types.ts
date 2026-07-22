// Shapes for the Live Dashboard (spec §6.5) and the Needs-Attention Feed (spec §6.6). These are
// the normative contract until the endpoints in docs/admin-api-contract.md land — the doc defers to
// this file where the two disagree.

/**
 * Why a booking is in the queue. The order of the union is the priority order the feed sorts by
 * (spec §6.6): the newest problem is rarely the worst one, so the queue is never chronological.
 */
export const ATTENTION_PRIORITIES = {
  escalated: "escalated",
  slaBreached: "sla_breached",
  failedAssignment: "failed_assignment",
  slaRisk: "sla_risk",
  noResponse: "no_response",
  escalatedAcknowledged: "escalated_acknowledged",
} as const;

export type AttentionPriority = (typeof ATTENTION_PRIORITIES)[keyof typeof ATTENTION_PRIORITIES];

/** The chip groups above the feed. `all` is a view, not a server filter. */
export const ATTENTION_FILTERS = {
  all: "all",
  escalated: "escalated",
  unassigned: "unassigned",
  sla: "sla",
  delayed: "delayed",
} as const;

export type AttentionFilter = (typeof ATTENTION_FILTERS)[keyof typeof ATTENTION_FILTERS];

/** Which of the two inline buttons a row offers. The reason decides, not the state (spec §6.6). */
export const ATTENTION_ACTIONS = {
  acknowledge: "acknowledge",
  assign: "assign",
  call: "call",
  cancel: "cancel",
  reassign: "reassign",
  redispatch: "redispatch",
} as const;

export type AttentionAction = (typeof ATTENTION_ACTIONS)[keyof typeof ATTENTION_ACTIONS];

export interface AttentionItem {
  /** The alert id — what `acknowledgeAlert` acts on. Distinct from the booking it points at. */
  readonly alertId: string;
  readonly bookingId: string;
  /** The operator-facing id, e.g. "#B-8823". Rendered in the mono ramp, never re-derived. */
  readonly bookingRef: string;
  readonly priority: AttentionPriority;
  readonly service: string;
  readonly customerName: string;
  readonly area: string;
  /** The diagnosis: the widest column on desktop and the only coloured line on a card. */
  readonly reason: string;
  readonly providerName: string | null;
  /**
   * The provider-column word the dashboard table shows when there is no name — "unassigned",
   * "unreachable". Null renders the em dash.
   */
  readonly providerState: "unassigned" | "unreachable" | null;
  /** When the problem surfaced. The age column is derived, never sent pre-formatted. */
  readonly surfacedAt: string;
  readonly slotAt: string;
  readonly amountPaise: number;
  readonly acknowledged: boolean;
}

export interface AttentionQueue {
  readonly items: readonly AttentionItem[];
  /** Total across every filter, so "Showing 5 of 7" is honest under a filter. */
  readonly total: number;
  readonly counts: Readonly<Record<AttentionFilter, number>>;
  /** Populated only when the queue is empty — the all-clear state cites the last resolution. */
  readonly lastCleared: {
    readonly at: string;
    readonly bookingRef: string;
    readonly adminName: string;
  } | null;
  /** Jobs running normally right now. The all-clear state counts them instead of the zero. */
  readonly healthyJobs: number;
  readonly updatedAt: string;
}

export const DASHBOARD_PERIODS = { today: "today", liveNow: "live_now" } as const;

export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[keyof typeof DASHBOARD_PERIODS];

export interface KpiDelta {
  /** Signed change against the same period yesterday. Direction is derived from the sign. */
  readonly value: number;
  /** Whether the movement is good news — a rising assign time is not (spec §6.5). */
  readonly isGood: boolean;
}

export interface DashboardSummary {
  readonly bookings: number;
  readonly bookingsDelta: KpiDelta;
  readonly revenuePaise: number;
  readonly revenueDelta: KpiDelta;
  /** 0..1. Rendered through formatPercent. */
  readonly completionRate: number;
  readonly completionDelta: KpiDelta;
  /** Mean SEARCHING → ASSIGNED, in ms. Measures the automation now (Booking-Workflow D3). */
  readonly avgAssignMs: number;
  /** Signed change in ms against yesterday. */
  readonly avgAssignDelta: KpiDelta;
  readonly sparklines: {
    readonly bookings: readonly number[];
    readonly revenue: readonly number[];
    readonly completion: readonly number[];
    readonly avgAssign: readonly number[];
  };
  readonly updatedAt: string;
}

export interface AlertBandExample {
  readonly bookingRef: string;
  readonly priority: AttentionPriority;
  readonly surfacedAt: string;
}

export interface AlertBandState {
  /** Unacknowledged criticals. Above 9 the band renders "9+" (spec §6.5 edge cases). */
  readonly criticalCount: number;
  /** At most two, by design: the band is a pointer into the queue, not the queue. */
  readonly examples: readonly AlertBandExample[];
}

export const ACTIVITY_KINDS = {
  completed: "completed",
  started: "started",
  enRoute: "en_route",
  assigned: "assigned",
  awaitingOtp: "awaiting_otp",
  cancelledByCustomer: "cancelled_by_customer",
} as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[keyof typeof ACTIVITY_KINDS];

export interface ActivityEntry {
  readonly id: string;
  readonly bookingRef: string;
  readonly kind: ActivityKind;
  /** Only the `assigned` kind carries one. */
  readonly providerName: string | null;
  readonly at: string;
}
