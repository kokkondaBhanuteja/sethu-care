import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import { NOTIFICATION_STATE_PARAM, NOTIFICATION_STATE_VALUES } from "./settings.constants";

export const NOTIFICATION_DELIVERY = {
  ok: "ok",
  /** The OS or browser refuses to deliver anything at all. */
  permissionDenied: "permissionDenied",
  /**
   * Permission is granted but the Critical Alerts channel is off at OS level (Android). Spec §6.30:
   * a silently disabled critical channel is the most dangerous state this app can be in.
   */
  criticalChannelOff: "criticalChannelOff",
} as const;

export type NotificationDelivery =
  (typeof NOTIFICATION_DELIVERY)[keyof typeof NOTIFICATION_DELIVERY];

function readBrowserPermission(): NotificationDelivery {
  // Older embedded webviews and non-secure origins omit Notification entirely; a missing API is
  // indistinguishable from a refusal as far as the operator is concerned, so it warns the same way.
  if (typeof Notification === "undefined") return NOTIFICATION_DELIVERY.permissionDenied;
  return Notification.permission === "denied"
    ? NOTIFICATION_DELIVERY.permissionDenied
    : NOTIFICATION_DELIVERY.ok;
}

/**
 * Whether escalation alerts can actually reach this admin (spec §6.30).
 *
 * On web the answer comes from the Notification permission API. On native the same two states are
 * reported by the OS: Capacitor's `PushNotifications.checkPermissions()` gives the permission half,
 * and the Android channel importance for the Critical Alerts channel gives the second — that is the
 * integration point, and it replaces `readBrowserPermission` without changing anything below.
 *
 * `?notify=denied|channel-off|quiet` forces a state so both dangerous banners are reachable in dev.
 */
export function useNotificationPermission() {
  const [searchParams] = useSearchParams();
  const override = searchParams.get(NOTIFICATION_STATE_PARAM);
  const [browserDelivery, setBrowserDelivery] = useState<NotificationDelivery>(readBrowserPermission);

  const refresh = useCallback(() => setBrowserDelivery(readBrowserPermission()), []);

  useEffect(() => {
    // Permission can change in a browser settings panel while this screen is open; re-reading on
    // focus is the only signal the web platform offers.
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    await Notification.requestPermission();
    refresh();
  }, [refresh]);

  const delivery: NotificationDelivery =
    override === NOTIFICATION_STATE_VALUES.denied
      ? NOTIFICATION_DELIVERY.permissionDenied
      : override === NOTIFICATION_STATE_VALUES.channelOff
        ? NOTIFICATION_DELIVERY.criticalChannelOff
        : browserDelivery;

  return {
    delivery,
    /** Every configurable switch is inert while the OS is discarding alerts before we are consulted. */
    areChannelsInert: delivery === NOTIFICATION_DELIVERY.permissionDenied,
    forceQuietHours: override === NOTIFICATION_STATE_VALUES.quiet,
    requestPermission,
  };
}
