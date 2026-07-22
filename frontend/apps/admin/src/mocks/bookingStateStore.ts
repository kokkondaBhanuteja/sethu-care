// Shared write-projection for booking records — the counterStore pattern applied to state.
//
// Without this, a committed mock mutation (cancel, assign…) leaves the read fixtures untouched:
// the operator cancels a booking, returns to the record, and it still reads as escalated and
// offers "Cancel booking" again — the demo lies about what just happened. A feature's WRITE mock
// records the transition here; the bookings READ mocks project it onto every list row and detail.
//
// It exists only until the backend serves real /ops/bookings writes. Like counterStore, nothing
// above a feature's `.api.ts`/`.mock.ts` knows it exists.

import { env } from "../lib/env";

export const BOOKING_WRITE_KINDS = {
  assign: "assign",
  cancel: "cancel",
  redispatch: "redispatch",
  manualComplete: "manualComplete",
} as const;

export type BookingWriteKind = (typeof BOOKING_WRITE_KINDS)[keyof typeof BOOKING_WRITE_KINDS];

export interface BookingTransition {
  readonly kind: BookingWriteKind;
  /** When the write committed — becomes the projected timeline entry's timestamp. */
  readonly at: string;
  /** The provider a manual assign attached, for the kinds that carry one. */
  readonly providerName?: string;
}

let transitions: ReadonlyMap<string, BookingTransition> = new Map();

export function readBookingTransition(bookingId: string): BookingTransition | undefined {
  return transitions.get(bookingId);
}

/** A committed write projects exactly one transition; a later write on the same record replaces it. */
export function recordBookingTransition(bookingId: string, transition: BookingTransition): void {
  transitions = new Map(transitions).set(bookingId, transition);
}

/** The undo path: the compensating call restores the read model along with the record. */
export function clearBookingTransition(bookingId: string): void {
  const next = new Map(transitions);
  next.delete(bookingId);
  transitions = next;
}

/** Back to the designed starting state — used by tests. */
export function resetBookingTransitions(): void {
  transitions = new Map();
}

/**
 * Dev-only URL trigger, in the app's established mock-trigger style (a booking id / a query
 * param): `?mockWrite=B-8823:cancel` — comma-separated for several — renders the post-write
 * projection without driving the flow, so a review or an e2e run can start from "already
 * cancelled". Absent the param, nothing changes: every documented trigger id keeps its state.
 */
export const MOCK_WRITE_PARAM = "mockWrite";

export function seedTransitionsFromParam(rawParam: string | null, at: string): void {
  if (rawParam === null) return;
  for (const entry of rawParam.split(",")) {
    const [bookingId, kind] = entry.split(":");
    if (!bookingId || !kind || !isBookingWriteKind(kind)) continue;
    recordBookingTransition(bookingId, { kind, at });
  }
}

function isBookingWriteKind(value: string): value is BookingWriteKind {
  const known: readonly string[] = Object.values(BOOKING_WRITE_KINDS);
  return known.includes(value);
}

if (env.isDev && typeof window !== "undefined") {
  seedTransitionsFromParam(
    new URLSearchParams(window.location.search).get(MOCK_WRITE_PARAM),
    new Date().toISOString(),
  );
}
