// The mock service behind settings.api.ts. Reads honour VITE_MOCK_MODE so every §4.10 state is
// reachable without a backend; writes mutate the fixture store so an optimistic update can be seen
// to stick (or, on a forced failure, to roll back).

import { mockRead, mockWrite } from "../../mocks/mockTransport";
import {
  APP_VERSION,
  EMPTY_PAYOUT_CYCLE,
  PAYOUT_CYCLE,
  QUEUED_ACTION_COUNT,
  settingsStore,
} from "./settings.fixtures";
import type {
  AdminPreferences,
  AdminProfile,
  AppVersion,
  NotificationSettings,
  PayoutCycle,
  SecuritySettings,
} from "./settings.types";

export function fetchNotificationSettingsMock(signal?: AbortSignal): Promise<NotificationSettings> {
  return mockRead(() => settingsStore.notifications, { signal });
}

export function saveNotificationSettingsMock(
  patch: Partial<NotificationSettings>,
  signal?: AbortSignal,
): Promise<NotificationSettings> {
  return mockWrite(() => {
    settingsStore.notifications = { ...settingsStore.notifications, ...patch };
    return settingsStore.notifications;
  }, { signal });
}


export function fetchSecuritySettingsMock(signal?: AbortSignal): Promise<SecuritySettings> {
  return mockRead(() => settingsStore.security, { signal });
}

export function saveBiometricUnlockMock(
  enabled: boolean,
  signal?: AbortSignal,
): Promise<SecuritySettings> {
  return mockWrite(() => {
    settingsStore.security = { ...settingsStore.security, biometricUnlock: enabled };
    return settingsStore.security;
  }, { signal });
}

export function revokeDeviceMock(deviceId: string, signal?: AbortSignal): Promise<SecuritySettings> {
  return mockWrite(() => {
    settingsStore.security = {
      ...settingsStore.security,
      devices: settingsStore.security.devices.filter((device) => device.id !== deviceId),
      activeSessions: Math.max(0, settingsStore.security.activeSessions - 1),
    };
    return settingsStore.security;
  }, { signal });
}

export function fetchAdminProfileMock(signal?: AbortSignal): Promise<AdminProfile> {
  return mockRead(() => settingsStore.profile, { signal });
}

export function saveAdminPreferencesMock(
  preferences: AdminPreferences,
  signal?: AbortSignal,
): Promise<AdminProfile> {
  return mockWrite(() => {
    settingsStore.profile = { ...settingsStore.profile, preferences };
    return settingsStore.profile;
  }, { signal });
}

export function fetchAppVersionMock(signal?: AbortSignal): Promise<AppVersion> {
  return mockRead(() => APP_VERSION, { signal });
}

export function fetchPayoutCycleMock(signal?: AbortSignal): Promise<PayoutCycle> {
  return mockRead(() => PAYOUT_CYCLE, { signal, emptyValue: EMPTY_PAYOUT_CYCLE });
}

export function fetchQueuedActionCountMock(signal?: AbortSignal): Promise<number> {
  return mockRead(() => QUEUED_ACTION_COUNT, { signal, emptyValue: 0 });
}
