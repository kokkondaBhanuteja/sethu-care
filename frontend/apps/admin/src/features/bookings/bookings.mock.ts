// Stands in for GET /ops/bookings and GET /ops/bookings/{id} until the backend serves them
// (docs/admin-api-contract.md). Filtering, searching and paging happen here so the hook and the
// components are written against the eventual server semantics, not against an in-memory array.

import { mockRead } from "../../mocks/mockTransport";
import { API_ERROR_CODES, apiError } from "../../lib/http/apiError";
import {
  BOOKING_SEGMENTS,
  BOOKING_STATES,
  SEGMENT_STATES,
  type BookingSegment,
} from "./bookings.constants";
import { BOOKING_DETAIL_FIXTURES } from "./booking-detail.fixtures";
import { ACTIVE_BOOKINGS, CANCELLED_BOOKINGS, COMPLETED_BOOKINGS } from "./bookings.fixtures";
import type {
  BookingDetail,
  BookingListItem,
  BookingSegmentCounts,
  BookingsPage,
  BookingsQuery,
} from "./bookings.types";

const BY_SEGMENT: Readonly<Record<BookingSegment, readonly BookingListItem[]>> = {
  [BOOKING_SEGMENTS.active]: ACTIVE_BOOKINGS,
  [BOOKING_SEGMENTS.completed]: COMPLETED_BOOKINGS,
  [BOOKING_SEGMENTS.cancelled]: CANCELLED_BOOKINGS,
};

const COUNTS: BookingSegmentCounts = {
  active: ACTIVE_BOOKINGS.length,
  completed: COMPLETED_BOOKINGS.length,
  cancelled: CANCELLED_BOOKINGS.length,
  activeHasEscalation: ACTIVE_BOOKINGS.some((item) => item.state === BOOKING_STATES.escalated),
};

const EMPTY_PAGE: BookingsPage = {
  items: [],
  total: 0,
  counts: { active: 0, completed: 0, cancelled: 0, activeHasEscalation: false },
  isAcrossSegments: false,
};

/** Spec §6.8: a search matches the id with or without `#B-`, the phone with or without `+91`. */
function matchesSearch(item: BookingListItem, search: string): boolean {
  const needle = search.toLowerCase().replace(/[\s#+-]/g, "");
  if (needle.length === 0) return true;
  const haystacks = [
    item.reference,
    item.customerPhone,
    item.customerName,
    item.serviceName,
    item.area,
    item.providerName ?? "",
  ];
  return haystacks.some((value) =>
    value
      .toLowerCase()
      .replace(/[\s#+-]/g, "")
      .includes(needle),
  );
}

function selectAll(): readonly BookingListItem[] {
  return [...ACTIVE_BOOKINGS, ...COMPLETED_BOOKINGS, ...CANCELLED_BOOKINGS];
}

function produce(query: BookingsQuery): BookingsPage {
  // A search spans every segment — the design's own count line says so ("Showing all 3 matches
  // across Active, Completed and Cancelled"), because an operator with a phone number on the line
  // does not know which bucket the booking is in.
  const isAcrossSegments = query.search.length > 0;
  const pool = isAcrossSegments ? selectAll() : BY_SEGMENT[query.segment];
  const allowed = SEGMENT_STATES[query.segment];

  const matched = pool.filter((item) => {
    if (!matchesSearch(item, query.search)) return false;
    if (query.states.length > 0) return query.states.includes(item.state);
    return isAcrossSegments || allowed.includes(item.state);
  });

  return {
    items: matched.slice(0, query.limit),
    total: matched.length,
    counts: COUNTS,
    isAcrossSegments,
  };
}

export function fetchBookingsMock(
  query: BookingsQuery,
  signal?: AbortSignal,
): Promise<BookingsPage> {
  return mockRead(() => produce(query), {
    ...(signal ? { signal } : {}),
    emptyValue: EMPTY_PAGE,
  });
}

/** Rows the artifacts do not draw in full still open on a real record, derived from the list entry. */
function deriveDetail(item: BookingListItem): BookingDetail {
  return {
    id: item.id,
    reference: item.reference,
    state: item.state,
    isAdminVerified: item.isAdminVerified,
    version: 1,
    serviceTitle: item.serviceName,
    area: item.area,
    amountPaise: item.amountPaise,
    createdAt: item.slotAt,
    escalation: null,
    dispatchRounds: [{ number: 1, radiusKm: 2.4, contacted: 3, declined: 0 }],
    declinedTotal: 0,
    customer: {
      name: item.customerName,
      phone: item.customerPhone,
      address: `${item.area}, Hyderabad`,
      bookingCount: 4,
      joinedAt: "2025-08-02T00:00:00+05:30",
    },
    provider: item.providerName
      ? { id: item.id, name: item.providerName, rating: 4.6, startedAt: null, completedAt: null }
      : null,
    payment: {
      amountPaise: item.amountPaise,
      isPrepaid: true,
      methodLabel: "UPI",
      last4: "4242",
      paidAt: item.slotAt,
      transactionId: `TXN${item.id.replace(/\D/g, "")}`,
    },
    verification: null,
    concurrentChange: null,
    timeline: [
      { id: "created", at: item.slotAt, kind: "created" },
      { id: "searching", at: item.slotAt, kind: "searching" },
    ],
    adminActivity: [],
    notes: [],
  };
}

export function fetchBookingDetailMock(
  bookingId: string,
  signal?: AbortSignal,
): Promise<BookingDetail> {
  return mockRead(
    () => {
      const drawn = BOOKING_DETAIL_FIXTURES.find((detail) => detail.id === bookingId);
      if (drawn) return drawn;

      const listed = selectAll().find((item) => item.id === bookingId);
      if (!listed) {
        throw apiError(API_ERROR_CODES.notFound, "This booking no longer exists.", { status: 404 });
      }
      return deriveDetail(listed);
    },
    signal ? { signal } : {},
  );
}
