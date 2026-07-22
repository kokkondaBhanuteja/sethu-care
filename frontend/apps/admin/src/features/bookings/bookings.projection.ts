// Maps a committed mock write (mocks/bookingStateStore) onto the read shapes, so the list and the
// record show the state a mutation just created instead of the fixture it started from. This file
// is mock plumbing: it is called only from bookings.mock.ts and goes away with it when the real
// GET /ops/bookings endpoints land.

import {
  readBookingTransition,
  BOOKING_WRITE_KINDS,
  type BookingTransition,
  type BookingWriteKind,
} from "../../mocks/bookingStateStore";
import { BOOKING_STATES, type BookingState } from "./bookings.constants";
import type { BookingDetail, BookingEvent, BookingListItem } from "./bookings.types";

/** The state each committed write leaves the record in (spec §4.3's transitions). */
const STATE_BY_WRITE: Readonly<Record<BookingWriteKind, BookingState>> = {
  [BOOKING_WRITE_KINDS.assign]: BOOKING_STATES.assigned,
  [BOOKING_WRITE_KINDS.cancel]: BOOKING_STATES.cancelled,
  [BOOKING_WRITE_KINDS.redispatch]: BOOKING_STATES.searching,
  [BOOKING_WRITE_KINDS.manualComplete]: BOOKING_STATES.completed,
};

const EVENT_BY_WRITE: Readonly<Record<BookingWriteKind, BookingEvent["kind"]>> = {
  [BOOKING_WRITE_KINDS.assign]: "autoAssigned",
  [BOOKING_WRITE_KINDS.cancel]: "cancelled",
  [BOOKING_WRITE_KINDS.redispatch]: "searching",
  [BOOKING_WRITE_KINDS.manualComplete]: "completedByAdmin",
};

export function projectListItem(item: BookingListItem): BookingListItem {
  const transition = readBookingTransition(item.id);
  if (!transition) return item;

  return {
    ...item,
    state: STATE_BY_WRITE[transition.kind],
    isAdminVerified:
      transition.kind === BOOKING_WRITE_KINDS.manualComplete ? true : item.isAdminVerified,
    ...(transition.kind === BOOKING_WRITE_KINDS.assign && transition.providerName
      ? { providerName: transition.providerName }
      : {}),
    // A settled or re-searching record must not keep advertising a stale "unassigned · 12m" note.
    ...(item.providerNote.kind === "unassignedFor" &&
    transition.kind !== BOOKING_WRITE_KINDS.redispatch
      ? { providerNote: { kind: "none" as const } }
      : {}),
  };
}

export function projectDetail(detail: BookingDetail): BookingDetail {
  const transition = readBookingTransition(detail.id);
  if (!transition) return detail;

  return {
    ...detail,
    state: STATE_BY_WRITE[transition.kind],
    // The write bumped the record's optimistic-concurrency token on the "server".
    version: detail.version + 1,
    // Any committed write resolves the escalation this record was flagged for.
    escalation: null,
    isAdminVerified:
      transition.kind === BOOKING_WRITE_KINDS.manualComplete ? true : detail.isAdminVerified,
    timeline: [...detail.timeline, transitionEvent(transition)],
  };
}

function transitionEvent(transition: BookingTransition): BookingEvent {
  return {
    id: `write-${transition.kind}`,
    at: transition.at,
    kind: EVENT_BY_WRITE[transition.kind],
    ...(transition.providerName ? { providerName: transition.providerName } : {}),
  };
}
