// Pure mappers from the generated /ops/bookings payloads (@sethu/api-client) onto this feature's
// normative shapes in bookings.types.ts. Every field is copied explicitly so a contract drift is a
// compile error here rather than a rendering surprise.

import type {
  BookingDetail as ApiBookingDetail,
  BookingEvent as ApiBookingEvent,
  BookingListItem as ApiBookingListItem,
  BookingsPage as ApiBookingsPage,
  DispatchRound as ApiDispatchRound,
  ProviderNote as ApiProviderNote,
} from "@sethu/api-client";

import { BOOKING_STATES } from "./bookings.constants";
import type {
  BookingDetail,
  BookingEvent,
  BookingListItem,
  BookingsPage,
  BookingsQuery,
  BookingsSummary,
  DispatchRound,
  ProviderNote,
} from "./bookings.types";

/** The server caps page size at 100; Load more grows the client's limit toward it. */
export const BOOKINGS_FETCH_CAP = 100;

/**
 * How the customer paid, as the record view words it. The server sends the ledger code and the
 * console owns the wording (English-only in practice, spec §4.7); "" plus a zero paidAt is the
 * server's "no payment yet", which stays "" so the payment line renders nothing false.
 */
const PAYMENT_METHOD_LABELS: Readonly<Record<string, string>> = {
  UPI: "UPI",
  CASH: "Cash",
  ONLINE: "Online",
};

export interface ListBookingsParams {
  readonly segment: BookingsQuery["segment"];
  readonly state?: BookingsQuery["states"][number][];
  readonly q?: string;
  readonly limit: number;
}

export function toListBookingsParams(query: BookingsQuery): ListBookingsParams {
  return {
    segment: query.segment,
    ...(query.states.length > 0 ? { state: [...query.states] } : {}),
    // Sent from three characters (spec §6.8) — the hook already blanks anything shorter. The
    // server matches the reference with or without its "#B-" prefix, so the term passes through.
    ...(query.search.length > 0 ? { q: query.search } : {}),
    limit: Math.min(query.limit, BOOKINGS_FETCH_CAP),
  };
}

export function mapProviderNote(note: ApiProviderNote): ProviderNote {
  switch (note.kind) {
    case "none":
      return { kind: "none" };
    case "unassignedFor":
      return { kind: "unassignedFor", minutes: note.minutes };
    case "eta":
      // The backend never sends an ETA today (phase-1 note); mapped anyway so the vocabulary
      // stays complete when it starts.
      return { kind: "eta", minutes: note.minutes };
    case "startedAt":
      return { kind: "startedAt", at: note.at };
    case "arrivedAgo":
      return { kind: "arrivedAgo", minutes: note.minutes };
    case "rating":
      return { kind: "rating", rating: note.rating };
  }
}

export function mapBookingListItem(item: ApiBookingListItem): BookingListItem {
  return {
    id: item.id,
    reference: item.reference,
    state: item.state,
    isAdminVerified: item.isAdminVerified,
    serviceName: item.serviceName,
    customerName: item.customerName,
    customerPhone: item.customerPhone,
    area: item.area,
    slotAt: item.slotAt,
    amountPaise: item.amountPaise,
    providerName: item.providerName,
    providerNote: mapProviderNote(item.providerNote),
  };
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** True when both instants fall on the same IST calendar day (§4.7: the console's clock is IST). */
function isSameIstDay(leftIso: string, right: Date): boolean {
  const leftIst = new Date(Date.parse(leftIso) + IST_OFFSET_MS);
  const rightIst = new Date(right.getTime() + IST_OFFSET_MS);
  return leftIst.toISOString().slice(0, 10) === rightIst.toISOString().slice(0, 10);
}

/**
 * The stat-strip figures. `GET /ops/bookings` does not carry a `summary` yet (a gap flagged to the
 * backend — bookings.types.ts is normative), so the strip is derived from the rows the query
 * returned. Best-effort by construction: it sees at most one page of one segment.
 */
export function deriveBookingsSummary(
  items: readonly BookingListItem[],
  now: Date = new Date(),
): BookingsSummary {
  const unassignedMinutes = items.flatMap((item) =>
    item.providerNote.kind === "unassignedFor" ? [item.providerNote.minutes] : [],
  );
  return {
    escalated: items.filter((item) => item.state === BOOKING_STATES.escalated).length,
    oldestUnassignedMinutes: unassignedMinutes.length > 0 ? Math.max(...unassignedMinutes) : null,
    completedToday: items.filter(
      (item) => item.state === BOOKING_STATES.completed && isSameIstDay(item.slotAt, now),
    ).length,
  };
}

export function mapBookingsPage(payload: ApiBookingsPage): BookingsPage {
  const items = payload.items.map(mapBookingListItem);
  return {
    items,
    total: payload.total,
    counts: {
      active: payload.counts.active,
      completed: payload.counts.completed,
      cancelled: payload.counts.cancelled,
      activeHasEscalation: payload.counts.activeHasEscalation,
    },
    summary: deriveBookingsSummary(items),
    isAcrossSegments: payload.isAcrossSegments,
  };
}

export function mapDispatchRound(round: ApiDispatchRound): DispatchRound {
  return {
    number: round.round,
    radiusKm: round.radiusKm,
    contacted: round.contacted,
    declined: round.declined,
  };
}

export function mapBookingEvent(event: ApiBookingEvent): BookingEvent {
  return {
    id: event.id,
    at: event.at,
    kind: event.kind,
    ...(event.round !== undefined ? { round: mapDispatchRound(event.round) } : {}),
    ...(event.actorName !== undefined ? { actorName: event.actorName } : {}),
    ...(event.providerName !== undefined ? { providerName: event.providerName } : {}),
  };
}

export function mapBookingDetail(payload: ApiBookingDetail): BookingDetail {
  return {
    id: payload.id,
    reference: payload.reference,
    state: payload.state,
    isAdminVerified: payload.isAdminVerified,
    version: payload.version,
    serviceTitle: payload.serviceTitle,
    area: payload.area,
    amountPaise: payload.amountPaise,
    createdAt: payload.createdAt,
    escalation: payload.escalation
      ? {
          minutesUnresolved: payload.escalation.minutesUnresolved,
          rounds: payload.escalation.rounds,
          declined: payload.escalation.declined,
        }
      : null,
    dispatchRounds: payload.dispatchRounds.map(mapDispatchRound),
    declinedTotal: payload.declinedTotal,
    customer: {
      name: payload.customer.name,
      phone: payload.customer.phone,
      address: payload.customer.address,
      bookingCount: payload.customer.bookingCount,
      joinedAt: payload.customer.joinedAt,
    },
    provider: payload.provider
      ? {
          id: payload.provider.id,
          name: payload.provider.name,
          rating: payload.provider.rating,
          startedAt: payload.provider.startedAt,
          completedAt: payload.provider.completedAt,
        }
      : null,
    payment: {
      amountPaise: payload.payment.amountPaise,
      isPrepaid: payload.payment.isPrepaid,
      methodLabel: PAYMENT_METHOD_LABELS[payload.payment.method] ?? "",
      last4: payload.payment.last4,
      paidAt: payload.payment.paidAt,
      transactionId: payload.payment.transactionId,
    },
    verification: payload.verification
      ? {
          verifiedByName: payload.verification.verifiedByName,
          verifiedAt: payload.verification.verifiedAt,
          disputeWindowClosesAt: payload.verification.disputeWindowClosesAt,
        }
      : null,
    concurrentChange: payload.concurrentChange
      ? {
          actorName: payload.concurrentChange.actorName,
          providerName: payload.concurrentChange.providerName,
          at: payload.concurrentChange.at,
        }
      : null,
    timeline: payload.timeline.map(mapBookingEvent),
    adminActivity: payload.adminActivity.map((activity) => ({
      id: activity.id,
      at: activity.at,
      kind: activity.kind,
      ...(activity.actorName !== undefined ? { actorName: activity.actorName } : {}),
    })),
    notes: [...payload.notes],
  };
}
