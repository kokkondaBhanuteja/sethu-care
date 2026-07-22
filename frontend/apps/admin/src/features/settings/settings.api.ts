// The only boundary between the settings screens and their data.
//
// None of these endpoints exists on the backend yet (docs/admin-api-contract.md lists them under
// "Settings"). Every call goes to the mock service today; when an endpoint lands, the generated
// client's call replaces the mock call here and nothing above this file changes.

import { normalizeError } from "../../lib/http/apiError";
import {
  fetchAdminProfileMock,
  fetchAppVersionMock,
  fetchNotificationSettingsMock,
  fetchPayoutCycleMock,
  fetchQueuedActionCountMock,
  fetchSecuritySettingsMock,
  revokeDeviceMock,
  saveAdminPreferencesMock,
  saveBiometricUnlockMock,
  saveNotificationSettingsMock,
} from "./settings.mock";
import type {
  AdminPreferences,
  AdminProfile,
  AppVersion,
  NotificationSettings,
  PayoutCycle,
  SecuritySettings,
} from "./settings.types";

export async function fetchNotificationSettings(
  signal?: AbortSignal,
): Promise<NotificationSettings> {
  try {
    return await fetchNotificationSettingsMock(signal);
  } catch (thrown) {
    throw normalizeError(thrown, "Notification settings could not be loaded.");
  }
}


export async function saveNotificationSettings(
  patch: Partial<NotificationSettings>,
  signal?: AbortSignal,
): Promise<NotificationSettings> {
  try {
    return await saveNotificationSettingsMock(patch, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "Those notification settings could not be saved.");
  }
}

export async function fetchSecuritySettings(signal?: AbortSignal): Promise<SecuritySettings> {
  try {
    return await fetchSecuritySettingsMock(signal);
  } catch (thrown) {
    throw normalizeError(thrown, "Security settings could not be loaded.");
  }
}

export async function saveBiometricUnlock(
  enabled: boolean,
  signal?: AbortSignal,
): Promise<SecuritySettings> {
  try {
    return await saveBiometricUnlockMock(enabled, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "Biometric unlock could not be changed.");
  }
}

export async function revokeDevice(
  deviceId: string,
  signal?: AbortSignal,
): Promise<SecuritySettings> {
  try {
    return await revokeDeviceMock(deviceId, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "That device could not be revoked.");
  }
}

export async function fetchAdminProfile(signal?: AbortSignal): Promise<AdminProfile> {
  try {
    return await fetchAdminProfileMock(signal);
  } catch (thrown) {
    throw normalizeError(thrown, "Your profile could not be loaded.");
  }
}

export async function saveAdminPreferences(
  preferences: AdminPreferences,
  signal?: AbortSignal,
): Promise<AdminProfile> {
  try {
    return await saveAdminPreferencesMock(preferences, signal);
  } catch (thrown) {
    throw normalizeError(thrown, "That preference could not be saved.");
  }
}

export async function fetchAppVersion(signal?: AbortSignal): Promise<AppVersion> {
  try {
    return await fetchAppVersionMock(signal);
  } catch (thrown) {
    throw normalizeError(thrown, "Version details could not be loaded.");
  }
}

export async function fetchPayoutCycle(signal?: AbortSignal): Promise<PayoutCycle> {
  try {
    return await fetchPayoutCycleMock(signal);
  } catch (thrown) {
    throw normalizeError(thrown, "The payout cycle could not be loaded.");
  }
}

export async function fetchQueuedActionCount(signal?: AbortSignal): Promise<number> {
  try {
    return await fetchQueuedActionCountMock(signal);
  } catch (thrown) {
    throw normalizeError(thrown, "Queued actions could not be counted.");
  }
}
