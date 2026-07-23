// The only boundary between the auth screens and data. Nothing in features/auth/ imports the mock
// directly; when the endpoints in docs/admin-api-contract.md ("MISSING — auth") land, only this
// file changes.
//
// None of these functions logs its arguments. A password or a passcode is passed through and
// dropped — it is never persisted, never put in a query key, and never echoed back to the caller.

import { env } from "../../lib/env";
import { API_ERROR_CODES, apiError } from "../../lib/http/apiError";
import { devBridgeLogin } from "./auth.devBridge";
import {
  mockBootstrap,
  mockLogin,
  mockResendOtp,
  mockRevokeDevice,
  mockUnlockWithPasscode,
  mockUnlockWithPassword,
  mockVerifyOtp,
} from "./auth.mock";
import type {
  BootstrapResult,
  LoginOutcome,
  LoginRequest,
  OtpChallenge,
  UnlockOutcome,
  VerifyOtpOutcome,
  VerifyOtpRequest,
} from "./auth.types";

/** Thrown until the endpoint exists, so a live-backend run fails loudly rather than silently. */
function notImplemented(endpoint: string): never {
  throw apiError(API_ERROR_CODES.server, `${endpoint} is not implemented on the backend yet.`, {
    status: 501,
  });
}

/** POST /admin/auth/bootstrap — resolves version support and stored session (spec §6.1). */
export function bootstrapApp(signal?: AbortSignal): Promise<BootstrapResult> {
  if (env.useMocks) return mockBootstrap(signal);
  // No bootstrap endpoint exists yet; resolve locally so the splash can route. `hasSession` is
  // decided by the hydrated session store (useSplashBoot reads it there, not from this payload).
  return Promise.resolve({
    isVersionSupported: true,
    hasSession: false,
    isBiometricEnabled: false,
  });
}

/** POST /admin/auth/login — email + password, first factor only. There is no signup (spec §10.1). */
export function login(request: LoginRequest, signal?: AbortSignal): Promise<LoginOutcome> {
  if (env.useMocks) return mockLogin(request, signal);
  // TEMPORARY: real mode signs in through the phone-OTP dev bridge until the contract's
  // `adminLogin` is implemented — see auth.devBridge.ts for the WHY and the replacement plan.
  return devBridgeLogin(signal);
}

/** POST /admin/auth/2fa — second factor plus device registration. */
export function verifyOtp(
  request: VerifyOtpRequest,
  signal?: AbortSignal,
): Promise<VerifyOtpOutcome> {
  if (env.useMocks) return mockVerifyOtp(request, signal);
  return notImplemented("POST /admin/auth/2fa");
}

/** POST /admin/auth/2fa/resend — a new code to the same number; only the latest one is valid. */
export function resendOtp(challengeId: string, signal?: AbortSignal): Promise<OtpChallenge> {
  if (env.useMocks) return mockResendOtp(signal);
  return notImplemented(`POST /admin/auth/2fa/resend (${challengeId})`);
}

/** DELETE /admin/auth/devices/{id} — frees a trust slot at the device limit (spec §5.3). */
export function revokeTrustedDevice(deviceId: string, signal?: AbortSignal): Promise<void> {
  if (env.useMocks) return mockRevokeDevice(deviceId, signal);
  return notImplemented("DELETE /admin/auth/devices/{id}");
}

/**
 * POST /admin/auth/unlock — re-verifies the password behind a locked session (desktop BOX 58).
 * Locking is not signing out: the session survives, so this never starts a fresh 2FA round.
 */
export function unlockWithPassword(password: string, signal?: AbortSignal): Promise<UnlockOutcome> {
  if (env.useMocks) return mockUnlockWithPassword(password, signal);
  return notImplemented("POST /admin/auth/unlock");
}

/**
 * Device-local passcode check. This has no endpoint and must never grow one — an unlock passcode
 * is verified on the device, and in the real build by the OS behind the biometric plugin.
 */
export function unlockWithPasscode(passcode: string, signal?: AbortSignal): Promise<boolean> {
  return mockUnlockWithPasscode(passcode, signal);
}
