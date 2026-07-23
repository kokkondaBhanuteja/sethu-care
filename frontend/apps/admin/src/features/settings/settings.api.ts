// The only boundary between the settings screens and their data.
//
// The settings endpoints are REAL (backend internal/adminaccount): with mocks off, every read is
// sdk call → pure mapper → feature types, and every write sends an `Idempotency-Key` header. The
// mock branch is untouched, so unit tests and designed-state walks behave exactly as before.
// The one exception is the payout cycle — the backend answers 501 (2026-07-23), so it stays
// mock-backed on both branches until a payouts service exists.

import {
  adminAppVersion,
  adminGetNotificationSettings,
  adminGetProfile,
  adminGetSecuritySettings,
  adminLogout,
  adminQueuedActionsCount,
  adminRevokeDevice,
  adminSubmitDiagnostics,
  adminUpdateNotificationSettings,
  adminUpdateProfile,
  adminUpdateSecuritySettings,
} from "@sethu/api-client";

import { env } from "../../lib/env";
import { call, FAILURE, idempotencyHeader, throwFailure, unwrap } from "./settings.api.errors";
import {
  mapAdminProfile,
  mapAppVersion,
  mapNotificationSettings,
  mapSecuritySettings,
} from "./settings.api.map";
import {
  toDiagnosticsRequest,
  toNotificationSettingsRequest,
  toProfileRequest,
  toSecuritySettingsRequest,
} from "./settings.api.requests";
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
  signOutServerSideMock,
  submitDiagnosticsMock,
} from "./settings.mock";
import type {
  AdminPreferences,
  AdminProfile,
  AppVersion,
  NotificationSettings,
  PayoutCycle,
  SecuritySettings,
} from "./settings.types";

export function fetchNotificationSettings(signal?: AbortSignal): Promise<NotificationSettings> {
  return call(async () => {
    if (env.useMocks) return fetchNotificationSettingsMock(signal);
    const result = await adminGetNotificationSettings({ signal });
    return mapNotificationSettings(unwrap(result, FAILURE.notifications));
  }, FAILURE.notifications);
}

/** PUT the whole configurable object; the server echoes its copy so optimism settles honestly. */
export function saveNotificationSettings(
  next: NotificationSettings,
  signal?: AbortSignal,
): Promise<NotificationSettings> {
  return call(async () => {
    if (env.useMocks) return saveNotificationSettingsMock(next, signal);
    const result = await adminUpdateNotificationSettings({
      ...idempotencyHeader(),
      body: toNotificationSettingsRequest(next),
      signal,
    });
    return mapNotificationSettings(unwrap(result, FAILURE.saveNotifications));
  }, FAILURE.saveNotifications);
}

export function fetchSecuritySettings(signal?: AbortSignal): Promise<SecuritySettings> {
  return call(async () => {
    if (env.useMocks) return fetchSecuritySettingsMock(signal);
    const result = await adminGetSecuritySettings({ signal });
    return mapSecuritySettings(unwrap(result, FAILURE.security));
  }, FAILURE.security);
}

export function saveBiometricUnlock(
  enabled: boolean,
  signal?: AbortSignal,
): Promise<SecuritySettings> {
  return call(async () => {
    if (env.useMocks) return saveBiometricUnlockMock(enabled, signal);
    const result = await adminUpdateSecuritySettings({
      ...idempotencyHeader(),
      body: toSecuritySettingsRequest(enabled),
      signal,
    });
    return mapSecuritySettings(unwrap(result, FAILURE.biometric));
  }, FAILURE.biometric);
}

/**
 * Revoke, then re-read: the revoke answers with a receipt, not the device list, so the updated
 * SecuritySettings the screen needs is fetched after the server confirms. Revoking the CURRENT
 * device still completes locally with sign-out + cache destruction (useSecuritySettings) — the
 * stateless JWT lives to its TTL server-side, which is why the local wipe is the load-bearing act.
 */
export function revokeDevice(deviceId: string, signal?: AbortSignal): Promise<SecuritySettings> {
  return call(async () => {
    if (env.useMocks) return revokeDeviceMock(deviceId, signal);
    const revoked = await adminRevokeDevice({
      ...idempotencyHeader(),
      path: { id: deviceId },
      signal,
    });
    unwrap(revoked, FAILURE.revoke);
    const result = await adminGetSecuritySettings({ signal });
    return mapSecuritySettings(unwrap(result, FAILURE.security));
  }, FAILURE.revoke);
}

export function fetchAdminProfile(signal?: AbortSignal): Promise<AdminProfile> {
  return call(async () => {
    if (env.useMocks) return fetchAdminProfileMock(signal);
    const result = await adminGetProfile({ signal });
    return mapAdminProfile(unwrap(result, FAILURE.profile));
  }, FAILURE.profile);
}

export function saveAdminPreferences(
  preferences: AdminPreferences,
  signal?: AbortSignal,
): Promise<AdminProfile> {
  return call(async () => {
    if (env.useMocks) return saveAdminPreferencesMock(preferences, signal);
    const result = await adminUpdateProfile({
      ...idempotencyHeader(),
      body: toProfileRequest(preferences),
      signal,
    });
    return mapAdminProfile(unwrap(result, FAILURE.savePreferences));
  }, FAILURE.savePreferences);
}

export function fetchAppVersion(signal?: AbortSignal): Promise<AppVersion> {
  return call(async () => {
    if (env.useMocks) return fetchAppVersionMock(signal);
    const result = await adminAppVersion({ signal });
    return mapAppVersion(unwrap(result, FAILURE.version));
  }, FAILURE.version);
}

/** MOCKED on both branches: the backend answers 501 for payouts (checked 2026-07-23). */
export function fetchPayoutCycle(signal?: AbortSignal): Promise<PayoutCycle> {
  return call(() => fetchPayoutCycleMock(signal), FAILURE.payouts);
}

export function fetchQueuedActionCount(signal?: AbortSignal): Promise<number> {
  return call(async () => {
    if (env.useMocks) return fetchQueuedActionCountMock(signal);
    const result = await adminQueuedActionsCount({ signal });
    return unwrap(result, FAILURE.queuedActions).count;
  }, FAILURE.queuedActions);
}

/**
 * Uploads diagnostics for support (spec §6.33). A 422 means the server found customer PII in the
 * payload and refused it — surfaced by useDiagnostics as the designed rejection, never retried
 * silently.
 */
export function submitDiagnostics(version: AppVersion, signal?: AbortSignal): Promise<void> {
  return call(async () => {
    if (env.useMocks) return submitDiagnosticsMock(signal);
    const result = await adminSubmitDiagnostics({
      ...idempotencyHeader(),
      body: toDiagnosticsRequest(version),
      signal,
    });
    unwrap(result, FAILURE.diagnostics);
  }, FAILURE.diagnostics);
}

/**
 * Close the session's server-side bookkeeping. Sessions are stateless JWTs, so the token stays
 * technically valid until its TTL — the local destruction in useSignOut is the load-bearing half,
 * which is why its caller treats this as best-effort rather than a gate.
 */
export function signOutServerSide(signal?: AbortSignal): Promise<void> {
  return call(async () => {
    if (env.useMocks) return signOutServerSideMock(signal);
    const result = await adminLogout({ ...idempotencyHeader(), signal });
    // 204 carries no body; the client still resolves `error` only on failure.
    if (result.error !== undefined) throwFailure(result, FAILURE.logout);
  }, FAILURE.logout);
}
