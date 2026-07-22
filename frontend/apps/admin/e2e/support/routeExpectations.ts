import {
  ROUTES,
  ROUTE_PATTERNS,
  ROUTE_TABLE,
  type RouteMeta,
} from "../../src/routes/routes.constants";
import {
  ALERT_TRIGGERS,
  APPLICATION_TRIGGERS,
  BOOKING_TRIGGERS,
  PROVIDER_TRIGGERS,
} from "./mockTriggers";

/**
 * How each route in the app's own route table announces itself, at desktop width.
 *
 * The shell spec walks `ROUTE_TABLE` and looks every pattern up here, so adding a route to the app
 * without adding it here fails the suite: a new destination cannot ship untested.
 */
export interface RouteExpectation {
  /** A concrete URL for the pattern — `:param` filled from the feature's documented mock trigger. */
  readonly url: string;
  /** The accessible name of the page heading, or of the dialog for the modal task routes. */
  readonly heading: string;
  /** Destructive and financial flows render as a modal over the record they act on. */
  readonly asDialog?: boolean;
  /** Set where the route deliberately redirects (desktop has no More menu). */
  readonly redirectsTo?: string;
  /**
   * Names an app defect this route currently hits. The spec marks such routes `test.fail()` —
   * a failing test is a finding, not something to weaken.
   */
  readonly defect?: string;
}

export const ROUTE_EXPECTATIONS: Readonly<Record<string, RouteExpectation>> = {
  [ROUTES.live]: { url: ROUTES.live, heading: "Live" },
  [ROUTES.liveAttention]: { url: ROUTES.liveAttention, heading: "Needs attention" },
  [ROUTES.liveMap]: { url: ROUTES.liveMap, heading: "Map" },

  [ROUTES.bookings]: { url: ROUTES.bookings, heading: "Bookings" },
  [ROUTE_PATTERNS.bookingDetail]: {
    url: ROUTES.bookingDetail(BOOKING_TRIGGERS.ordinary),
    heading: `#${BOOKING_TRIGGERS.ordinary}`,
  },
  [ROUTE_PATTERNS.bookingAssign]: {
    url: ROUTES.bookingAssign(BOOKING_TRIGGERS.ordinary),
    heading: "Assign provider",
    asDialog: true,
  },
  [ROUTE_PATTERNS.bookingCancel]: {
    url: ROUTES.bookingCancel(BOOKING_TRIGGERS.ordinary),
    heading: "Cancel booking",
    asDialog: true,
  },
  [ROUTE_PATTERNS.bookingRedispatch]: {
    url: ROUTES.bookingRedispatch(BOOKING_TRIGGERS.ordinary),
    heading: "Re-run auto-dispatch",
    asDialog: true,
  },
  [ROUTE_PATTERNS.bookingManualComplete]: {
    url: ROUTES.bookingManualComplete(BOOKING_TRIGGERS.ordinary),
    heading: "Manual completion",
    asDialog: true,
  },
  [ROUTE_PATTERNS.bookingRefund]: {
    url: ROUTES.bookingRefund(BOOKING_TRIGGERS.refund),
    heading: "Issue refund",
    asDialog: true,
  },

  [ROUTES.providers]: { url: ROUTES.providers, heading: "Providers" },
  [ROUTE_PATTERNS.providerDetail]: {
    url: ROUTES.providerDetail(PROVIDER_TRIGGERS.withActiveJobs),
    heading: "Suresh Mehta",
  },
  [ROUTE_PATTERNS.providerSuspend]: {
    url: ROUTES.providerSuspend(PROVIDER_TRIGGERS.withActiveJobs),
    heading: "Suspend provider",
    asDialog: true,
  },
  [ROUTES.applications]: { url: ROUTES.applications, heading: "Applications" },
  [ROUTE_PATTERNS.applicationReview]: {
    url: ROUTES.applicationReview(APPLICATION_TRIGGERS.pending),
    heading: "Ajay Verma",
  },

  [ROUTES.alerts]: { url: ROUTES.alerts, heading: "Alerts" },
  [ROUTE_PATTERNS.alertDetail]: {
    url: ROUTES.alertDetail(ALERT_TRIGGERS.existing),
    heading: "Alert",
  },

  // Desktop has no More menu — the always-visible sidebar is its equivalent, so /more lands on the
  // one destination the sidebar does not name (pages/MoreMenuPage.tsx).
  [ROUTES.more]: { url: ROUTES.more, heading: "Profile", redirectsTo: ROUTES.profile },
  [ROUTES.customers]: { url: ROUTES.customers, heading: "Customers — Coming in v1.1" },
  [ROUTE_PATTERNS.customerDetail]: {
    url: ROUTES.customerDetail("CUS-1"),
    heading: "Customers — Coming in v1.1",
  },
  [ROUTES.tickets]: { url: ROUTES.tickets, heading: "Support tickets — Coming in v1.1" },
  [ROUTE_PATTERNS.ticketDetail]: {
    url: ROUTES.ticketDetail("TCK-1"),
    heading: "Support tickets — Coming in v1.1",
  },
  [ROUTES.analytics]: { url: ROUTES.analytics, heading: "Analytics — Coming in v1.1" },
  [ROUTES.audit]: { url: ROUTES.audit, heading: "Audit log" },
  [ROUTES.notificationSettings]: { url: ROUTES.notificationSettings, heading: "Notifications" },
  [ROUTES.securitySettings]: { url: ROUTES.securitySettings, heading: "Security & devices" },
  [ROUTES.profile]: { url: ROUTES.profile, heading: "Profile" },
  [ROUTES.support]: { url: ROUTES.support, heading: "Help & support" },

  [ROUTES.services]: { url: ROUTES.services, heading: "Services & pricing" },
  [ROUTES.pricing]: { url: ROUTES.pricing, heading: "Pricing rules" },
  [ROUTES.payouts]: { url: ROUTES.payouts, heading: "Payouts & settlements" },
  [ROUTES.reports]: { url: ROUTES.reports, heading: "Reports & exports" },
  [ROUTES.platformSettings]: { url: ROUTES.platformSettings, heading: "Platform settings" },

  // Mobile-only in the route table, but a desktop deep link must still resolve: above 768px the
  // password lock renders instead of the biometric one (features/auth/CLAUDE.md).
  [ROUTES.unlock]: { url: ROUTES.unlock, heading: "Your session is locked", asDialog: true },
};

export function expectationFor(route: RouteMeta): RouteExpectation {
  const expectation = ROUTE_EXPECTATIONS[route.pattern];
  if (!expectation) {
    throw new Error(
      `No route expectation for "${route.pattern}". Every entry in ROUTE_TABLE needs one in ` +
        `e2e/support/routeExpectations.ts — that is how a new route cannot ship untested.`,
    );
  }
  return expectation;
}

export const ALL_ROUTES: readonly RouteMeta[] = ROUTE_TABLE;
