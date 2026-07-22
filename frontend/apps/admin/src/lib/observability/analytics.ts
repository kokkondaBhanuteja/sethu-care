import { env } from "../env";
import { scrub } from "./reporter";

// Analytics, behind the same kind of seam as error reporting.
//
// Admin spec §6.x names the events each screen must emit — `notification_settings_viewed`,
// `notification_category_toggled`, `critical_channel_disabled_detected`, and so on. None were being
// emitted because there was no client. This gives every call site somewhere real to call, so the
// events exist in the code and adopting a vendor is a one-line change at boot rather than a sweep
// through forty screens.
//
// Event names are a closed vocabulary on purpose. A free-string `track()` produces a warehouse full
// of `booking_cancelled`, `bookingCancelled` and `cancel_booking` within a quarter.

export const ANALYTICS_EVENTS = {
  screenViewed: "screen_viewed",

  bookingAssigned: "booking_assigned",
  bookingCancelled: "booking_cancelled",
  bookingRedispatched: "booking_redispatched",
  bookingManuallyCompleted: "booking_manually_completed",
  refundIssued: "refund_issued",
  actionUndone: "action_undone",

  alertAcknowledged: "alert_acknowledged",

  providerSuspended: "provider_suspended",
  providerBlocked: "provider_blocked",
  applicationApproved: "application_approved",
  applicationRejected: "application_rejected",

  notificationCategoryToggled: "notification_category_toggled",
  quietHoursConfigured: "quiet_hours_configured",
  notificationPermissionDenied: "notification_permission_denied",
  criticalChannelDisabledDetected: "critical_channel_disabled_detected",

  stepUpChallenged: "step_up_challenged",
  stepUpFailed: "step_up_failed",
  permissionDenied: "permission_denied",
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/**
 * Event properties. Deliberately narrow: ids, codes, counts and durations — the things an analysis
 * actually groups by. Never a name, a phone number, an address or a reason NOTE (the reason CODE is
 * fine and is the useful dimension anyway).
 */
export interface AnalyticsProperties {
  readonly [key: string]: string | number | boolean | undefined;
}

export interface AnalyticsTransport {
  track: (event: AnalyticsEvent, properties: AnalyticsProperties) => void;
  identify: (adminId: string) => void;
  reset: () => void;
}

const noopTransport: AnalyticsTransport = {
  track: () => undefined,
  identify: () => undefined,
  reset: () => undefined,
};

let transport: AnalyticsTransport = noopTransport;

/** Install the real client once, at boot. Absent one, every call is a no-op rather than an error. */
export function setAnalyticsTransport(custom: AnalyticsTransport): void {
  transport = custom;
}

export function track(event: AnalyticsEvent, properties: AnalyticsProperties = {}): void {
  transport.track(event, scrub(properties) as AnalyticsProperties);
  if (env.isDev) console.info(`analytics: ${event}`, properties);
}

/** Ties events to the acting admin. Called after sign-in; `resetAnalytics` on sign-out. */
export function identifyAdmin(adminId: string): void {
  transport.identify(adminId);
}

export function resetAnalytics(): void {
  transport.reset();
}
