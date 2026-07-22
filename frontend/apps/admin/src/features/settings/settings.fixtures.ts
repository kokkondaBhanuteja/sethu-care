// Fixture data for the settings family, lifted from the approved artifacts (desktop BOX 59–67,
// mobile BOX 95–109) so a screen can be compared against its design tile directly.
//
// The records are mutable module state on purpose: a toggle has to survive a refetch inside one
// session, which is what makes the optimistic-update path honest to test against.

import { DEVICE_KINDS, PAYOUT_STATUSES, SECURITY_EVENT_KINDS } from "./settings.constants";
import type {
  AdminProfile,
  AppVersion,
  NotificationSettings,
  PayoutCycle,
  PayoutRow,
  PayoutStatus,
  SecuritySettings,
} from "./settings.types";

const PAISE_PER_RUPEE = 100;

export const settingsStore = {
  notifications: {
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
    digestTime: "21:00",
    quietHours: { enabled: true, from: "22:00", to: "07:00" },
    criticalSound: "Urgent",
    vibrate: true,
    queuedDuringQuietHours: 3,
  } as NotificationSettings,

  security: {
    biometricUnlock: true,
    deviceLimit: 3,
    activeSessions: 3,
    passwordChangedAtIso: "2026-07-02T10:45:00.000Z",
    devices: [
      {
        id: "dev-iphone-14",
        name: "iPhone 14",
        kind: DEVICE_KINDS.phone,
        lastUsedIso: "2026-07-22T09:00:00.000Z",
        location: "Hyderabad",
        isCurrent: true,
      },
      {
        id: "dev-pixel-7",
        name: "Pixel 7",
        kind: DEVICE_KINDS.phone,
        lastUsedIso: "2026-07-20T09:00:00.000Z",
        location: "Hyderabad",
        isCurrent: false,
      },
      {
        id: "dev-ipad-air",
        name: "iPad Air",
        kind: DEVICE_KINDS.tablet,
        lastUsedIso: "2026-07-04T09:00:00.000Z",
        location: "Secunderabad",
        isCurrent: false,
      },
    ],
    events: [
      {
        id: "sec-1",
        kind: SECURITY_EVENT_KINDS.signedIn,
        device: "iPhone 14",
        location: "Hyderabad",
        atIso: "2026-07-22T02:44:00.000Z",
      },
      {
        id: "sec-2",
        kind: SECURITY_EVENT_KINDS.failedSignIn,
        device: null,
        location: null,
        atIso: "2026-07-19T17:32:00.000Z",
      },
      {
        id: "sec-3",
        kind: SECURITY_EVENT_KINDS.deviceTrusted,
        device: "Pixel 7",
        location: "Hyderabad",
        atIso: "2026-07-18T04:01:00.000Z",
      },
      {
        id: "sec-4",
        kind: SECURITY_EVENT_KINDS.passwordChanged,
        device: "iPhone 14",
        location: "Hyderabad",
        atIso: "2026-07-02T10:45:00.000Z",
      },
    ],
  } as SecuritySettings,

  profile: {
    adminId: "ADM-004",
    name: "Ravi Kumar",
    email: "ravi@setucare.in",
    maskedPhone: "+91 •••••43210",
    role: "Operations",
    joinedIso: "2025-03-12T00:00:00.000Z",
    activity: {
      actions: 47,
      escalationsAcknowledged: 12,
      averageAcknowledgeMs: 108_000,
      bookingsRescued: 9,
    },
    preferences: { appearance: "system", haptics: true, defaultLandingRoute: "live" },
  } as AdminProfile,
};

export const APP_VERSION: AppVersion = {
  app: "1.0.0",
  build: "142",
  environment: "Production",
  bundle: "ota-2026.07.19-a",
};

function payoutRow(
  providerId: string,
  providerName: string,
  jobs: number,
  gross: number,
  commission: number,
  adjustments: number,
  net: number,
  status: PayoutStatus,
): PayoutRow {
  return {
    providerId,
    providerName,
    jobs,
    grossPaise: gross * PAISE_PER_RUPEE,
    commissionPaise: commission * PAISE_PER_RUPEE,
    adjustmentsPaise: adjustments * PAISE_PER_RUPEE,
    netPaise: net * PAISE_PER_RUPEE,
    status,
  };
}

export const PAYOUT_CYCLE: PayoutCycle = {
  pendingPaise: 482_000 * PAISE_PER_RUPEE,
  providersAwaiting: 62,
  zones: 9,
  cycleClosesIso: "2026-07-25T00:30:00.000Z",
  nextRunIso: "2026-07-25T00:30:00.000Z",
  nextRunTime: "06:00",
  lastRunPaise: 614_000 * PAISE_PER_RUPEE,
  lastRunIso: "2026-07-18T00:30:00.000Z",
  lastRunProviders: 71,
  rows: [
    payoutRow("prv-sm", "Suresh Mehta", 42, 58_400, 11_680, 0, 46_720, PAYOUT_STATUSES.ready),
    payoutRow("prv-kr", "Kiran Rao", 38, 49_200, 9_840, -1_200, 38_160, PAYOUT_STATUSES.ready),
    payoutRow("prv-av", "Ajay Verma", 31, 41_800, 8_360, 0, 33_440, PAYOUT_STATUSES.ready),
    payoutRow("prv-md", "Mohan Das", 12, 14_400, 2_880, -4_500, 7_020, PAYOUT_STATUSES.onHold),
    payoutRow("prv-vs", "Vikram Singh", 28, 36_200, 7_240, 0, 28_960, PAYOUT_STATUSES.ready),
    payoutRow("prv-lr", "Lakshmi Reddy", 19, 22_800, 4_560, 0, 18_240, PAYOUT_STATUSES.blocked),
    payoutRow("prv-dn", "Deepak Naik", 24, 31_600, 6_320, 0, 25_280, PAYOUT_STATUSES.ready),
    payoutRow("prv-an", "Anitha Nair", 24, 30_200, 6_040, 0, 24_160, PAYOUT_STATUSES.ready),
  ],
  totals: {
    jobs: 218,
    grossPaise: 264_600 * PAISE_PER_RUPEE,
    commissionPaise: 52_920 * PAISE_PER_RUPEE,
    adjustmentsPaise: -5_700 * PAISE_PER_RUPEE,
    netPaise: 482_000 * PAISE_PER_RUPEE,
  },
};

export const EMPTY_PAYOUT_CYCLE: PayoutCycle = {
  ...PAYOUT_CYCLE,
  rows: [],
  totals: { jobs: 0, grossPaise: 0, commissionPaise: 0, adjustmentsPaise: 0, netPaise: 0 },
};

/** Offline actions waiting to sync — the count the sign-out confirm exists to name (spec §6.22). */
export const QUEUED_ACTION_COUNT = 2;
