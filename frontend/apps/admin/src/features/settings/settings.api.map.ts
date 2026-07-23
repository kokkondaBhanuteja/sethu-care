// Pure mappers from the generated settings payloads (@sethu/api-client) onto this feature's
// normative shapes — every field copied explicitly so a contract drift is a compile error here.
// The channel, device-kind, event-kind and appearance vocabularies are proven equal literal-for-
// literal by these assignments. Requests: settings.api.requests.ts.

import type {
  AdminActivitySummary as ApiAdminActivitySummary,
  AdminPreferences as ApiAdminPreferences,
  AdminProfile as ApiAdminProfile,
  AppVersion as ApiAppVersion,
  NotificationChannelSettings as ApiNotificationChannelSettings,
  NotificationSettings as ApiNotificationSettings,
  QuietHours as ApiQuietHours,
  SecurityEvent as ApiSecurityEvent,
  SecuritySettings as ApiSecuritySettings,
  TrustedDevice as ApiTrustedDevice,
} from "@sethu/api-client";

import type {
  AdminActivity,
  AdminPreferences,
  AdminProfile,
  AppVersion,
  NotificationSettings,
  QuietHours,
  SecurityEvent,
  SecuritySettings,
  TrustedDevice,
} from "./settings.types";

function mapChannels(payload: ApiNotificationChannelSettings): NotificationSettings["channels"] {
  // Only the configurable tier travels — the critical channels are not preferences (spec §6.30)
  // and have no slot in this payload, so the UI's locked rows stay static by construction.
  return {
    slaAtRisk: payload.slaAtRisk,
    providerNoShow: payload.providerNoShow,
    zoneSupplyCritical: payload.zoneSupplyCritical,
    paymentFailure: payload.paymentFailure,
    newApplications: payload.newApplications,
    autoSuspensions: payload.autoSuspensions,
    documentExpiring: payload.documentExpiring,
    dailySummary: payload.dailySummary,
  };
}

function mapQuietHours(payload: ApiQuietHours): QuietHours {
  return { enabled: payload.enabled, from: payload.from, to: payload.to };
}

export function mapNotificationSettings(payload: ApiNotificationSettings): NotificationSettings {
  return {
    channels: mapChannels(payload.channels),
    digestTime: payload.digestTime,
    quietHours: mapQuietHours(payload.quietHours),
    criticalSound: payload.criticalSound,
    vibrate: payload.vibrate,
    queuedDuringQuietHours: payload.queuedDuringQuietHours,
  };
}

/**
 * The settings DeviceKind has no "desktop" value (a contract quirk — the auth trust list's
 * DeviceType does), so a desktop console session arrives as kind "tablet" and renders with the
 * tablet glyph. Mapped honestly rather than guessed from the name. `location` arrives "" today
 * (no geo-IP); the row omits its separator rather than dangling it.
 */
export function mapTrustedDevice(payload: ApiTrustedDevice): TrustedDevice {
  return {
    id: payload.id,
    name: payload.name,
    kind: payload.kind,
    lastUsedIso: payload.lastUsedIso,
    location: payload.location,
    isCurrent: payload.isCurrent,
  };
}

export function mapSecurityEvent(payload: ApiSecurityEvent): SecurityEvent {
  return {
    id: payload.id,
    kind: payload.kind,
    device: payload.device,
    location: payload.location,
    atIso: payload.atIso,
  };
}

export function mapSecuritySettings(payload: ApiSecuritySettings): SecuritySettings {
  return {
    biometricUnlock: payload.biometricUnlock,
    devices: payload.devices.map(mapTrustedDevice),
    deviceLimit: payload.deviceLimit,
    activeSessions: payload.activeSessions,
    passwordChangedAtIso: payload.passwordChangedAtIso,
    events: payload.events.map(mapSecurityEvent),
  };
}

function mapActivity(payload: ApiAdminActivitySummary): AdminActivity {
  return {
    actions: payload.actions,
    escalationsAcknowledged: payload.escalationsAcknowledged,
    averageAcknowledgeMs: payload.averageAcknowledgeMs,
    bookingsRescued: payload.bookingsRescued,
  };
}

/**
 * The wire vocabulary for `defaultLandingRoute` is absolute routes ("/live" — the server 422s a
 * bare id) while the console's landing picker holds tab ids ("live"). The slash is stripped here
 * and restored by toProfileRequest, so each side keeps its own vocabulary.
 */
function mapPreferences(payload: ApiAdminPreferences): AdminPreferences {
  return {
    appearance: payload.appearance,
    haptics: payload.haptics,
    defaultLandingRoute: payload.defaultLandingRoute.replace(/^\//, ""),
  };
}

export function mapAdminProfile(payload: ApiAdminProfile): AdminProfile {
  return {
    adminId: payload.adminId,
    name: payload.name,
    email: payload.email,
    maskedPhone: payload.maskedPhone,
    role: payload.role,
    joinedIso: payload.joinedIso,
    activity: mapActivity(payload.activity),
    preferences: mapPreferences(payload.preferences),
  };
}

export function mapAppVersion(payload: ApiAppVersion): AppVersion {
  return {
    app: payload.app,
    build: payload.build,
    environment: payload.environment,
    bundle: payload.bundle,
  };
}
