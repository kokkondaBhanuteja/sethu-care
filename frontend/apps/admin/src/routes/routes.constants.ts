// The only place a URL is written in this app (ENGINEERING-STANDARDS Part 4). Everything else
// navigates through ROUTES; nothing composes a path string inline.
//
// Source: Admin spec §3.2, as amended by docs/Booking-Workflow-Decisions.md — the reschedule route
// is deleted (D1: on-demand only, rescheduling is removed from the product) and assign is a
// rescue-only destination reached from an escalation, not a routine queue action.

import { ADMIN_ACTIONS, type AdminAction } from "../lib/permissions/actions";

/** Bottom-tab groupings (spec §3.1). Five is the maximum before targets get too small. */
export const TABS = {
  live: "live",
  bookings: "bookings",
  providers: "providers",
  alerts: "alerts",
  more: "more",
} as const;

export type Tab = (typeof TABS)[keyof typeof TABS];

/**
 * Which shells a route is reachable in (spec §1.5). `desktopOnly` is a product rule, not a
 * consequence of separate builds: on a phone the route still renders — as the "Best on desktop"
 * notice — because a deep link must never produce a blank screen or a 404.
 */
export const SURFACES = {
  all: "all",
  desktopOnly: "desktopOnly",
  mobileOnly: "mobileOnly",
} as const;

export type Surface = (typeof SURFACES)[keyof typeof SURFACES];

export const ROUTES = {
  splash: "/splash",
  login: "/login",
  loginOtp: "/login/otp",
  unlock: "/unlock",

  live: "/live",
  liveAttention: "/live/attention",
  liveMap: "/live/map",

  bookings: "/bookings",
  bookingDetail: (bookingId: string) => `/bookings/${bookingId}`,
  bookingAssign: (bookingId: string) => `/bookings/${bookingId}/assign`,
  bookingCancel: (bookingId: string) => `/bookings/${bookingId}/cancel`,
  bookingRedispatch: (bookingId: string) => `/bookings/${bookingId}/redispatch`,
  bookingManualComplete: (bookingId: string) => `/bookings/${bookingId}/manual-complete`,
  bookingRefund: (bookingId: string) => `/bookings/${bookingId}/refund`,

  providers: "/providers",
  providerDetail: (providerId: string) => `/providers/${providerId}`,
  providerSuspend: (providerId: string) => `/providers/${providerId}/suspend`,
  applications: "/providers/applications",
  applicationReview: (applicationId: string) => `/providers/applications/${applicationId}`,

  alerts: "/alerts",
  alertDetail: (alertId: string) => `/alerts/${alertId}`,

  more: "/more",
  customers: "/customers",
  customerDetail: (customerId: string) => `/customers/${customerId}`,
  tickets: "/tickets",
  ticketDetail: (ticketId: string) => `/tickets/${ticketId}`,
  analytics: "/analytics",
  audit: "/audit",

  notificationSettings: "/settings/notifications",
  securitySettings: "/settings/security",
  profile: "/profile",
  support: "/support",

  services: "/services",
  pricing: "/pricing",
  payouts: "/payouts",
  reports: "/reports",
  platformSettings: "/settings/platform",
} as const;

/** Route-path patterns as React Router sees them — with `:param` rather than a built value. */
export const ROUTE_PATTERNS = {
  bookingDetail: "/bookings/:bookingId",
  bookingAssign: "/bookings/:bookingId/assign",
  bookingCancel: "/bookings/:bookingId/cancel",
  bookingRedispatch: "/bookings/:bookingId/redispatch",
  bookingManualComplete: "/bookings/:bookingId/manual-complete",
  bookingRefund: "/bookings/:bookingId/refund",
  providerDetail: "/providers/:providerId",
  providerSuspend: "/providers/:providerId/suspend",
  applicationReview: "/providers/applications/:applicationId",
  alertDetail: "/alerts/:alertId",
  customerDetail: "/customers/:customerId",
  ticketDetail: "/tickets/:ticketId",
} as const;

export interface RouteMeta {
  readonly pattern: string;
  readonly tab: Tab | null;
  readonly surface: Surface;
  /** Guarded destinations name the action they represent, so RequirePermission needs no lookup table. */
  readonly action?: AdminAction;
}

/**
 * The route table. Shells read it to build navigation, guards read it to decide access, and the
 * "Best on desktop" notice reads it to explain which surface a destination belongs to.
 */
export const ROUTE_TABLE: readonly RouteMeta[] = [
  { pattern: ROUTES.live, tab: TABS.live, surface: SURFACES.all },
  { pattern: ROUTES.liveAttention, tab: TABS.live, surface: SURFACES.all },
  { pattern: ROUTES.liveMap, tab: TABS.live, surface: SURFACES.all },

  { pattern: ROUTES.bookings, tab: TABS.bookings, surface: SURFACES.all },
  { pattern: ROUTE_PATTERNS.bookingDetail, tab: TABS.bookings, surface: SURFACES.all },
  {
    pattern: ROUTE_PATTERNS.bookingAssign,
    tab: TABS.bookings,
    surface: SURFACES.all,
    action: ADMIN_ACTIONS.assignProvider,
  },
  {
    pattern: ROUTE_PATTERNS.bookingCancel,
    tab: TABS.bookings,
    surface: SURFACES.all,
    action: ADMIN_ACTIONS.cancelBooking,
  },
  {
    pattern: ROUTE_PATTERNS.bookingRedispatch,
    tab: TABS.bookings,
    surface: SURFACES.all,
    action: ADMIN_ACTIONS.redispatch,
  },
  {
    pattern: ROUTE_PATTERNS.bookingManualComplete,
    tab: TABS.bookings,
    surface: SURFACES.all,
    action: ADMIN_ACTIONS.manualComplete,
  },
  {
    pattern: ROUTE_PATTERNS.bookingRefund,
    tab: TABS.more,
    surface: SURFACES.all,
    action: ADMIN_ACTIONS.refund,
  },

  { pattern: ROUTES.providers, tab: TABS.providers, surface: SURFACES.all },
  { pattern: ROUTE_PATTERNS.providerDetail, tab: TABS.providers, surface: SURFACES.all },
  {
    pattern: ROUTE_PATTERNS.providerSuspend,
    tab: TABS.providers,
    surface: SURFACES.all,
    action: ADMIN_ACTIONS.suspendProvider,
  },
  { pattern: ROUTES.applications, tab: TABS.providers, surface: SURFACES.all },
  { pattern: ROUTE_PATTERNS.applicationReview, tab: TABS.providers, surface: SURFACES.all },

  { pattern: ROUTES.alerts, tab: TABS.alerts, surface: SURFACES.all },
  { pattern: ROUTE_PATTERNS.alertDetail, tab: TABS.alerts, surface: SURFACES.all },

  { pattern: ROUTES.more, tab: TABS.more, surface: SURFACES.all },
  { pattern: ROUTES.customers, tab: TABS.more, surface: SURFACES.all },
  { pattern: ROUTE_PATTERNS.customerDetail, tab: TABS.more, surface: SURFACES.all },
  { pattern: ROUTES.tickets, tab: TABS.more, surface: SURFACES.all },
  { pattern: ROUTE_PATTERNS.ticketDetail, tab: TABS.more, surface: SURFACES.all },
  { pattern: ROUTES.analytics, tab: TABS.more, surface: SURFACES.all },
  { pattern: ROUTES.audit, tab: TABS.more, surface: SURFACES.all },
  { pattern: ROUTES.notificationSettings, tab: TABS.more, surface: SURFACES.all },
  { pattern: ROUTES.securitySettings, tab: TABS.more, surface: SURFACES.all },
  { pattern: ROUTES.profile, tab: TABS.more, surface: SURFACES.all },
  { pattern: ROUTES.support, tab: TABS.more, surface: SURFACES.all },

  // Finance and configuration: batch processes and ledger work, not phone work (spec §1.5).
  { pattern: ROUTES.services, tab: null, surface: SURFACES.desktopOnly },
  { pattern: ROUTES.pricing, tab: null, surface: SURFACES.desktopOnly },
  { pattern: ROUTES.payouts, tab: null, surface: SURFACES.desktopOnly },
  { pattern: ROUTES.reports, tab: null, surface: SURFACES.desktopOnly },
  { pattern: ROUTES.platformSettings, tab: null, surface: SURFACES.desktopOnly },

  { pattern: ROUTES.unlock, tab: null, surface: SURFACES.mobileOnly },
];

/** Where an authenticated admin lands with no deep-link intent. */
export const DEFAULT_ROUTE = ROUTES.live;
