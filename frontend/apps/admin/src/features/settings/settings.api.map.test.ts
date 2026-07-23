import { describe, expect, it } from "vitest";

import type {
  AdminProfile as ApiAdminProfile,
  NotificationSettings as ApiNotificationSettings,
  SecuritySettings as ApiSecuritySettings,
} from "@sethu/api-client";

import {
  mapAdminProfile,
  mapAppVersion,
  mapNotificationSettings,
  mapSecuritySettings,
} from "./settings.api.map";
import { toNotificationSettingsRequest, toProfileRequest } from "./settings.api.requests";

const NOTIFICATIONS: ApiNotificationSettings = {
  channels: {
    slaAtRisk: true,
    providerNoShow: true,
    zoneSupplyCritical: true,
    paymentFailure: true,
    newApplications: false,
    autoSuspensions: true,
    documentExpiring: false,
    dailySummary: true,
  },
  criticalSound: "default",
  digestTime: "08:00",
  quietHours: { enabled: false, from: "22:00", to: "07:00" },
  vibrate: true,
  queuedDuringQuietHours: 0,
};

const SECURITY: ApiSecuritySettings = {
  biometricUnlock: false,
  deviceLimit: 3,
  activeSessions: 2,
  passwordChangedAtIso: "2026-07-02T10:45:00Z",
  devices: [
    {
      id: "dev-1",
      name: "Probe",
      kind: "tablet",
      lastUsedIso: "2026-07-23T05:55:00Z",
      location: "",
      isCurrent: true,
    },
  ],
  events: [
    {
      id: "sec-1",
      kind: "signedIn",
      device: "Probe",
      location: null,
      atIso: "2026-07-23T05:55:00Z",
    },
  ],
};

const PROFILE: ApiAdminProfile = {
  adminId: "adm-1",
  name: "Demo Admin",
  email: "ops@setucare.in",
  maskedPhone: "+91 •••••00008",
  role: "ADMIN",
  joinedIso: "2026-07-23T05:43:00Z",
  activity: {
    actions: 13,
    escalationsAcknowledged: 0,
    averageAcknowledgeMs: 0,
    bookingsRescued: 1,
  },
  preferences: { appearance: "system", haptics: true, defaultLandingRoute: "/live" },
};

describe("mapNotificationSettings", () => {
  it("copies the configurable tier field by field — the critical tier has no slot at all", () => {
    const mapped = mapNotificationSettings(NOTIFICATIONS);
    expect(mapped.channels).toEqual(NOTIFICATIONS.channels);
    expect(mapped.queuedDuringQuietHours).toBe(0);
    expect(mapped.quietHours).toEqual({ enabled: false, from: "22:00", to: "07:00" });
  });
});

describe("toNotificationSettingsRequest", () => {
  it("sends the whole configurable object and drops the server-owned queued count", () => {
    const body = toNotificationSettingsRequest(mapNotificationSettings(NOTIFICATIONS));
    expect(body.channels).toEqual(NOTIFICATIONS.channels);
    expect("queuedDuringQuietHours" in body).toBe(false);
  });
});

describe("mapSecuritySettings", () => {
  it("keeps the tablet-kind quirk and the empty location honest", () => {
    const mapped = mapSecuritySettings(SECURITY);
    // The settings DeviceKind has no "desktop" — a desktop session arrives as "tablet" and is
    // rendered as sent, not guessed from the name.
    expect(mapped.devices[0]).toMatchObject({ kind: "tablet", location: "", isCurrent: true });
    expect(mapped.events[0]).toMatchObject({ kind: "signedIn", location: null });
    expect(mapped.activeSessions).toBe(2);
  });
});

describe("mapAdminProfile", () => {
  it("normalises the seeded route path onto the console's tab-id vocabulary", () => {
    const mapped = mapAdminProfile(PROFILE);
    // The server seeds "/live"; the landing picker's values are tab ids ("live").
    expect(mapped.preferences.defaultLandingRoute).toBe("live");
    expect(mapped.activity.averageAcknowledgeMs).toBe(0);
    expect(mapped.maskedPhone).toBe("+91 •••••00008");
  });

  it("writes the tab id back as the absolute route the server demands", () => {
    const body = toProfileRequest(mapAdminProfile(PROFILE).preferences);
    // A bare id is a 422 ("defaultLandingRoute must be an absolute route", proven live).
    expect(body.preferences.defaultLandingRoute).toBe("/live");
  });
});

describe("mapAppVersion", () => {
  it("passes the honest statics through untouched", () => {
    const mapped = mapAppVersion({
      app: "unknown",
      build: "unknown",
      environment: "development",
      bundle: "unknown",
    });
    expect(mapped).toEqual({
      app: "unknown",
      build: "unknown",
      environment: "development",
      bundle: "unknown",
    });
  });
});
