// Feature payloads → the generated request bodies, copied field by field so a contract drift is a
// compile error here (the mirror of settings.api.map.ts, which maps responses).
//
// The `Idempotency-Key` never appears in a body: it travels as a HEADER, attached in
// settings.api.ts.

import type {
  DiagnosticsRequest,
  UpdateAdminProfileRequest,
  UpdateNotificationSettingsRequest,
  UpdateSecuritySettingsRequest,
} from "@sethu/api-client";

import type { AdminPreferences, AppVersion, NotificationSettings } from "./settings.types";

/**
 * The PUT carries the whole configurable object, never a partial — the contract has no PATCH
 * here, and `queuedDuringQuietHours` is the server's own count, so it has no slot in the request.
 * A critical channel can never ride along: the channels object only has configurable keys.
 */
export function toNotificationSettingsRequest(
  next: NotificationSettings,
): UpdateNotificationSettingsRequest {
  return {
    channels: {
      slaAtRisk: next.channels.slaAtRisk,
      providerNoShow: next.channels.providerNoShow,
      zoneSupplyCritical: next.channels.zoneSupplyCritical,
      paymentFailure: next.channels.paymentFailure,
      newApplications: next.channels.newApplications,
      autoSuspensions: next.channels.autoSuspensions,
      documentExpiring: next.channels.documentExpiring,
      dailySummary: next.channels.dailySummary,
    },
    criticalSound: next.criticalSound,
    digestTime: next.digestTime,
    quietHours: {
      enabled: next.quietHours.enabled,
      from: next.quietHours.from,
      to: next.quietHours.to,
    },
    vibrate: next.vibrate,
  };
}

export function toProfileRequest(preferences: AdminPreferences): UpdateAdminProfileRequest {
  return {
    preferences: {
      appearance: preferences.appearance,
      haptics: preferences.haptics,
      // The wire vocabulary is absolute routes ("/live" — the server 422s on a bare id); the
      // console's landing picker holds tab ids. The read mapper strips the slash, this restores it.
      defaultLandingRoute: `/${preferences.defaultLandingRoute.replace(/^\//, "")}`,
    },
  };
}

export function toSecuritySettingsRequest(biometricUnlock: boolean): UpdateSecuritySettingsRequest {
  return { biometricUnlock };
}

/** The parenthetical OS segment of the user agent — "Macintosh; Intel Mac OS X 10_15_7". */
const USER_AGENT_OS_SEGMENT = /\(([^)]+)\)/;

/**
 * The diagnostics upload (spec §6.33). Device fields are coarse on purpose — enough for support
 * to reproduce, no fingerprinting. `logs` and `networkEvents` are honestly empty: the console
 * keeps no rolling buffers yet, and inventing entries would poison the support trail. No customer
 * data can appear because none is collected here.
 */
export function toDiagnosticsRequest(version: AppVersion): DiagnosticsRequest {
  const agent = window.navigator.userAgent;
  return {
    appVersion: version.app,
    otaBundle: version.bundle,
    deviceModel: describeDeviceModel(agent),
    osVersion: USER_AGENT_OS_SEGMENT.exec(agent)?.[1] ?? "unknown",
    logs: [],
    networkEvents: [],
  };
}

const DEVICE_MODEL_LABELS: readonly (readonly [RegExp, string])[] = [
  [/iPad/i, "iPad"],
  [/iPhone/i, "iPhone"],
  [/Android/i, "Android device"],
  [/Macintosh/i, "Mac"],
  [/Windows/i, "Windows PC"],
];

// The same coarse platform table as auth's deviceIdentity — features cannot import siblings, so
// the duplication stands until the helper is promoted to lib/ (CLAUDE.md).
function describeDeviceModel(agent: string): string {
  const match = DEVICE_MODEL_LABELS.find(([pattern]) => pattern.test(agent));
  return match ? match[1] : "Browser";
}
