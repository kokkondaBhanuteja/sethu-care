// Vocabulary and presentation rules for the bookings feature.
//
// BOOKING_STATES mirrors backend/internal/booking/state.go verbatim (the closed set of thirteen).
// It lives here rather than in @sethu/domain because neither the generated client
// (`BookingResponse.state` is a bare `string`) nor @sethu/domain exports it yet. When the backend
// contract grows a real enum, delete this block and re-export the generated one — nothing else in
// the feature compares against a literal.

import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  History,
  Lock,
  KeyRound,
  Navigation,
  NotebookPen,
  Play,
  Radar,
  ShieldCheck,
  Siren,
  User,
  UserCheck,
  Wallet,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import type { PillTone } from "../../components/ui/Pill";

export const BOOKING_STATES = {
  draft: "DRAFT",
  confirmed: "CONFIRMED",
  searching: "SEARCHING",
  assigned: "ASSIGNED",
  enRoute: "EN_ROUTE",
  arrived: "ARRIVED",
  inProgress: "IN_PROGRESS",
  awaitingCompletion: "AWAITING_COMPLETION",
  completed: "COMPLETED",
  escalated: "ESCALATED",
  rescheduled: "RESCHEDULED",
  cancelled: "CANCELLED",
  failed: "FAILED",
} as const;

export type BookingState = (typeof BOOKING_STATES)[keyof typeof BOOKING_STATES];

/**
 * Three segments, deliberately not four: docs/Booking-Workflow-Decisions.md D1 removed "Scheduled"
 * because nothing is future-dated — a booking dispatches the instant it is created.
 */
export const BOOKING_SEGMENTS = {
  active: "active",
  completed: "completed",
  cancelled: "cancelled",
} as const;

export type BookingSegment = (typeof BOOKING_SEGMENTS)[keyof typeof BOOKING_SEGMENTS];

/** Cancelled also holds FAILED — a job nobody could be sent to is a dead booking, not an active one. */
export const SEGMENT_STATES: Readonly<Record<BookingSegment, readonly BookingState[]>> = {
  [BOOKING_SEGMENTS.active]: [
    BOOKING_STATES.draft,
    BOOKING_STATES.confirmed,
    BOOKING_STATES.searching,
    BOOKING_STATES.assigned,
    BOOKING_STATES.enRoute,
    BOOKING_STATES.arrived,
    BOOKING_STATES.inProgress,
    BOOKING_STATES.awaitingCompletion,
    BOOKING_STATES.escalated,
    BOOKING_STATES.rescheduled,
  ],
  [BOOKING_SEGMENTS.completed]: [BOOKING_STATES.completed],
  [BOOKING_SEGMENTS.cancelled]: [BOOKING_STATES.cancelled, BOOKING_STATES.failed],
};

export interface BookingStatePresentation {
  readonly tone: PillTone;
  readonly icon: LucideIcon;
  /** A live, still-changing state pulses — searching and escalated only (spec §4.3). */
  readonly pulse: boolean;
  /** Row tint in the desktop table; the mobile card's severity edge reads the same value. */
  readonly rowTone: "default" | "danger" | "warning";
}

/**
 * Admin spec §4.3, mapped onto the backend's thirteen states. Two of the spec's display rows are
 * not separate states in the machine: "Waiting Start OTP" IS `ARRIVED` (arrival is the state of
 * waiting for that OTP), and "Completed (Admin Verified)" is `COMPLETED` carrying a verification
 * record — the striped pill is applied from that flag, not from a fourteenth state.
 */
export const BOOKING_STATE_PRESENTATION: Readonly<Record<BookingState, BookingStatePresentation>> =
  {
    [BOOKING_STATES.draft]: { tone: "neutral", icon: Clock, pulse: false, rowTone: "default" },
    [BOOKING_STATES.confirmed]: { tone: "neutral", icon: Clock, pulse: false, rowTone: "default" },
    [BOOKING_STATES.searching]: { tone: "info", icon: Radar, pulse: true, rowTone: "default" },
    [BOOKING_STATES.assigned]: { tone: "info", icon: UserCheck, pulse: false, rowTone: "default" },
    [BOOKING_STATES.enRoute]: { tone: "info", icon: Navigation, pulse: false, rowTone: "default" },
    [BOOKING_STATES.arrived]: { tone: "warning", icon: Lock, pulse: false, rowTone: "warning" },
    [BOOKING_STATES.inProgress]: { tone: "success", icon: Play, pulse: false, rowTone: "default" },
    [BOOKING_STATES.awaitingCompletion]: {
      tone: "warning",
      icon: KeyRound,
      pulse: false,
      rowTone: "warning",
    },
    [BOOKING_STATES.completed]: {
      tone: "success",
      icon: CheckCircle2,
      pulse: false,
      rowTone: "default",
    },
    [BOOKING_STATES.escalated]: { tone: "danger", icon: Siren, pulse: true, rowTone: "danger" },
    [BOOKING_STATES.rescheduled]: {
      tone: "info",
      icon: CalendarClock,
      pulse: false,
      rowTone: "default",
    },
    [BOOKING_STATES.cancelled]: {
      tone: "neutral",
      icon: XCircle,
      pulse: false,
      rowTone: "default",
    },
    [BOOKING_STATES.failed]: {
      tone: "danger",
      icon: AlertTriangle,
      pulse: false,
      rowTone: "danger",
    },
  };

/** The admin-verified completion keeps the green of a success but swaps the glyph (spec §4.3). */
export const ADMIN_VERIFIED_ICON: LucideIcon = ShieldCheck;

/** Soft chip accents the record view's section cards may use (Figma #7's icon-headed cards). */
export type DetailSectionAccent = "blue" | "green" | "purple" | "neutral";

export interface DetailSectionChip {
  readonly icon: LucideIcon;
  readonly accent: DetailSectionAccent;
}

/**
 * The approved record-view language: every section card opens with a soft icon chip, and the
 * accents are fixed per section so the same section reads the same on every booking — customer is
 * always the blue person, provider (and its search diagnostics) the green wrench, the timeline the
 * neutral history glyph, payment the purple wallet.
 */
export const DETAIL_SECTION_CHIPS = {
  customer: { icon: User, accent: "blue" },
  provider: { icon: Wrench, accent: "green" },
  timeline: { icon: History, accent: "neutral" },
  payment: { icon: Wallet, accent: "purple" },
  adminActions: { icon: ShieldCheck, accent: "neutral" },
  notes: { icon: NotebookPen, accent: "neutral" },
} as const satisfies Record<string, DetailSectionChip>;

/** Assign is a rescue tool now that dispatch is automated (Booking-Workflow-Decisions §7). */
export const RESCUE_STATES: readonly BookingState[] = [
  BOOKING_STATES.escalated,
  BOOKING_STATES.failed,
];

/** Trailing context for the "Showing 10 of 24 …" count line the design puts under every list. */
export const SEGMENT_SUBJECT_KEYS = {
  [BOOKING_SEGMENTS.active]: "count.subjectActive",
  [BOOKING_SEGMENTS.completed]: "count.subjectCompleted",
  [BOOKING_SEGMENTS.cancelled]: "count.subjectCancelled",
} as const;

export const BOOKING_QUERY_KEYS = {
  list: (segment: BookingSegment, search: string, states: readonly BookingState[], limit: number) =>
    ["bookings", "list", segment, search, states.join(","), limit] as const,
  detail: (bookingId: string) => ["bookings", "detail", bookingId] as const,
};

/** The design's own page size: BOX 15 renders ten rows under "Showing 10 of 24 active bookings". */
export const BOOKINGS_PAGE_SIZE = 10;

/** Spec §6.8: search is server-side and only fires from three characters. */
export const SEARCH_MIN_LENGTH = 3;

/**
 * Deep-link intent (spec §3.4 rule 4). An action route that finds its booking already resolved
 * sends the operator here instead, and the detail explains what happened rather than opening a
 * sheet for a situation somebody else has already handled.
 */
export const BOOKING_INTENT_PARAM = "intent";
