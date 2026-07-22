// The artifact-accurate booking rows: every record named here is lifted from the approved designs
// (desktop BOX 15–17, mobile BOX 25–29) so a screen can be compared against its design tile
// directly. The generated filler that brings the segments up to their advertised counts lives in
// bookings.fixtures.ts.

import { BOOKING_STATES, type BookingState } from "./bookings.constants";
import type { BookingListItem, ProviderNote } from "./bookings.types";

/** Every fixture timestamp sits on one day so the rendered times match the artifacts exactly. */
const FIXTURE_DAY = "2026-07-20";

export function istInstant(hoursAndMinutes: string): string {
  return `${FIXTURE_DAY}T${hoursAndMinutes}:00+05:30`;
}

export interface BookingSeed {
  readonly reference: string;
  readonly state: BookingState;
  readonly serviceName: string;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly area: string;
  readonly slot: string;
  readonly amountPaise: number;
  readonly providerName: string | null;
  readonly providerNote: ProviderNote;
  readonly isAdminVerified?: boolean;
}

export function toItem(seed: BookingSeed): BookingListItem {
  return {
    id: seed.reference.replace("#", ""),
    reference: seed.reference,
    state: seed.state,
    isAdminVerified: seed.isAdminVerified ?? false,
    serviceName: seed.serviceName,
    customerName: seed.customerName,
    customerPhone: seed.customerPhone,
    area: seed.area,
    slotAt: istInstant(seed.slot),
    amountPaise: seed.amountPaise,
    providerName: seed.providerName,
    providerNote: seed.providerNote,
  };
}

export const ACTIVE_SEEDS: readonly BookingSeed[] = [
  {
    reference: "#B-8823",
    state: BOOKING_STATES.escalated,
    serviceName: "AC Repair",
    customerName: "Ravi Kumar",
    customerPhone: "+919876543210",
    area: "Kompally",
    slot: "15:30",
    amountPaise: 149900,
    providerName: null,
    providerNote: { kind: "unassignedFor", minutes: 12 },
  },
  {
    reference: "#B-8817",
    state: BOOKING_STATES.enRoute,
    serviceName: "Plumbing",
    customerName: "Anita Sharma",
    customerPhone: "+919876511204",
    area: "Gachibowli",
    slot: "16:00",
    amountPaise: 89900,
    providerName: "Suresh Mehta",
    providerNote: { kind: "eta", minutes: 8 },
  },
  {
    reference: "#B-8809",
    state: BOOKING_STATES.inProgress,
    serviceName: "Electrical",
    customerName: "Meena Reddy",
    customerPhone: "+919701122334",
    area: "Miyapur",
    slot: "14:15",
    amountPaise: 120000,
    providerName: "Kiran Rao",
    providerNote: { kind: "startedAt", at: istInstant("15:04") },
  },
  {
    reference: "#B-8805",
    state: BOOKING_STATES.arrived,
    serviceName: "Refrigerator",
    customerName: "Arun Teja",
    customerPhone: "+919440087651",
    area: "Madhapur",
    slot: "15:00",
    amountPaise: 74900,
    providerName: "Ajay Verma",
    providerNote: { kind: "arrivedAgo", minutes: 12 },
  },
  {
    reference: "#B-8830",
    state: BOOKING_STATES.searching,
    serviceName: "Air Conditioner — Deep Clean & Gas Refill (Split, 2 Ton)",
    customerName: "శ్రీనివాస వెంకటేశ్వర రావు",
    customerPhone: "+919885512340",
    area: "Kompally",
    slot: "16:45",
    amountPaise: 249900,
    providerName: null,
    providerNote: { kind: "unassignedFor", minutes: 2 },
  },
  {
    reference: "#B-8811",
    state: BOOKING_STATES.awaitingCompletion,
    serviceName: "Washing Machine Repair",
    customerName: "प्रियंका श्रीनिवासन रामचंद्रन",
    customerPhone: "+919812277431",
    area: "Miyapur",
    slot: "13:20",
    amountPaise: 99900,
    providerName: "Ajay Verma",
    providerNote: { kind: "arrivedAgo", minutes: 46 },
  },
  {
    // The record BOX 9 / M11 draw: escalated here, already rescued by another operator on the
    // server. It stays escalated in this list precisely because the local copy is behind.
    reference: "#B-8820",
    state: BOOKING_STATES.escalated,
    serviceName: "AC Repair",
    customerName: "Ravi Kumar",
    customerPhone: "+919876543210",
    area: "Kompally",
    slot: "15:35",
    amountPaise: 149900,
    providerName: null,
    providerNote: { kind: "unassignedFor", minutes: 14 },
  },
  {
    reference: "#B-8799",
    state: BOOKING_STATES.inProgress,
    serviceName: "Plumbing",
    customerName: "Vikram Sood",
    customerPhone: "+919000112233",
    area: "Miyapur",
    slot: "14:40",
    amountPaise: 89900,
    providerName: "Mohan Das",
    providerNote: { kind: "startedAt", at: istInstant("14:52") },
  },
  {
    reference: "#B-8794",
    state: BOOKING_STATES.enRoute,
    serviceName: "Electrical",
    customerName: "Deepa Nair",
    customerPhone: "+919845567788",
    area: "Gachibowli",
    slot: "16:15",
    amountPaise: 105000,
    providerName: "Kiran Rao",
    providerNote: { kind: "eta", minutes: 14 },
  },
  {
    reference: "#B-8791",
    state: BOOKING_STATES.assigned,
    serviceName: "AC Repair",
    customerName: "Rahul Menon",
    customerPhone: "+919922334455",
    area: "Madhapur",
    slot: "16:30",
    amountPaise: 149900,
    providerName: "Ajay Verma",
    providerNote: { kind: "eta", minutes: 22 },
  },
  {
    reference: "#B-8785",
    state: BOOKING_STATES.arrived,
    serviceName: "Plumbing",
    customerName: "Naveen Rao",
    customerPhone: "+919676543211",
    area: "Kompally",
    slot: "14:45",
    amountPaise: 89900,
    providerName: "Kiran Rao",
    providerNote: { kind: "arrivedAgo", minutes: 6 },
  },
];
