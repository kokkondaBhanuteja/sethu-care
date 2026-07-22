// The generated filler that makes the tab counts honest — 24 active, 118 completed, 9 cancelled —
// so "Load more" has something to load and "Showing 10 of 24 active bookings" is not a fiction.
// The artifact-accurate rows live in bookings.seed.ts.

import { BOOKING_STATES, type BookingState } from "./bookings.constants";
import { ACTIVE_SEEDS, toItem } from "./bookings.seed";
import type { BookingListItem } from "./bookings.types";

type NonEmpty<TValue> = readonly [TValue, ...TValue[]];

const FILLER_STATES: NonEmpty<BookingState> = [
  BOOKING_STATES.assigned,
  BOOKING_STATES.enRoute,
  BOOKING_STATES.inProgress,
  BOOKING_STATES.searching,
  BOOKING_STATES.arrived,
];
const FILLER_SERVICES: NonEmpty<string> = [
  "AC Repair",
  "Plumbing",
  "Electrical",
  "Refrigerator",
  "Carpentry",
];
const FILLER_CUSTOMERS: NonEmpty<string> = [
  "Sneha Kapoor",
  "Lakshmi Rao",
  "Imran Qureshi",
  "Joseph Mathew",
  "Kavya Iyer",
];
const FILLER_PROVIDERS: NonEmpty<string> = ["Suresh Mehta", "Ajay Verma", "Kiran Rao", "Mohan Das"];
const FILLER_AREAS: NonEmpty<string> = ["Kompally", "Miyapur", "Madhapur", "Gachibowli"];
const FILLER_AMOUNTS: NonEmpty<number> = [149900, 89900, 74900, 120000, 105000];

function cycle<TValue>(values: NonEmpty<TValue>, offset: number): TValue {
  return values[offset % values.length] ?? values[0];
}

/** Deterministic fillers — the same list every reload, so a screenshot diff means a code change. */
function buildFiller(
  count: number,
  firstNumber: number,
  state: BookingState | null,
): readonly BookingListItem[] {
  return Array.from({ length: count }, (_unused, index) => {
    const bookingNumber = firstNumber - index * 3;
    const offset = index + bookingNumber;
    const hour = String(9 + (index % 9)).padStart(2, "0");
    return toItem({
      reference: `#B-${bookingNumber}`,
      state: state ?? cycle(FILLER_STATES, offset),
      serviceName: cycle(FILLER_SERVICES, offset),
      customerName: cycle(FILLER_CUSTOMERS, offset),
      customerPhone: `+9198${String(700000 + bookingNumber).slice(0, 6)}${String(bookingNumber).slice(-2)}`,
      area: cycle(FILLER_AREAS, offset),
      slot: `${hour}:${index % 2 === 0 ? "15" : "45"}`,
      amountPaise: cycle(FILLER_AMOUNTS, offset),
      providerName: cycle(FILLER_PROVIDERS, offset),
      providerNote: { kind: "rating", rating: 4.4 + (index % 5) / 10 },
    });
  });
}

export const ACTIVE_BOOKINGS: readonly BookingListItem[] = [
  ...ACTIVE_SEEDS.map(toItem),
  ...buildFiller(13, 8780, null),
];

/** #B-8801 and #B-8788 are the two completions the artifact draws; the rest reach the tab's 118. */
export const COMPLETED_BOOKINGS: readonly BookingListItem[] = [
  toItem({
    reference: "#B-8801",
    state: BOOKING_STATES.completed,
    serviceName: "AC Repair",
    customerName: "Sneha Kapoor",
    customerPhone: "+919021098765",
    area: "Kompally",
    slot: "13:00",
    amountPaise: 149900,
    providerName: "Suresh Mehta",
    providerNote: { kind: "rating", rating: 4.8 },
  }),
  toItem({
    reference: "#B-8788",
    state: BOOKING_STATES.completed,
    serviceName: "Refrigerator",
    customerName: "Lakshmi Rao",
    customerPhone: "+919845123456",
    area: "Madhapur",
    slot: "13:45",
    amountPaise: 74900,
    providerName: "Suresh Mehta",
    providerNote: { kind: "rating", rating: 4.6 },
    isAdminVerified: true,
  }),
  ...buildFiller(116, 8770, BOOKING_STATES.completed),
];

export const CANCELLED_BOOKINGS: readonly BookingListItem[] = [
  toItem({
    reference: "#B-8776",
    state: BOOKING_STATES.failed,
    serviceName: "Carpentry",
    customerName: "Imran Qureshi",
    customerPhone: "+919701765432",
    area: "Gachibowli",
    slot: "11:30",
    amountPaise: 59900,
    providerName: null,
    providerNote: { kind: "none" },
  }),
  ...buildFiller(8, 8760, BOOKING_STATES.cancelled),
];
