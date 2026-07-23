// The only boundary between the auth screens and data. The admin auth endpoints are REAL
// (backend internal/adminaccount): with mocks off, every call is sdk call → pure mapper →
// feature types, and the designed refusals arrive as DECLARED bodies mapped onto the same
// outcome types the mocks produce — nothing above this file can tell the difference.
//
// None of these functions logs its arguments. A password or a passcode is passed through and
// dropped — it is never persisted, never put in a query key, and never echoed back to the caller.

import {
  adminBootstrap,
  adminLogin,
  adminResendOtp,
  adminRevokeDevice,
  adminUnlock,
  adminVerifyOtp,
} from "@sethu/api-client";

import { env } from "../../lib/env";
import { normalizeError } from "../../lib/http/apiError";
import {
  FAILURE,
  loginFailureOutcome,
  mintIdempotencyKey,
  throwFailure,
  unwrap,
  verifyFailureOutcome,
} from "./auth.api.errors";
import { mapAdminSession, mapLoginResult, mapOtpChallenge } from "./auth.api.map";
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

/** Everything thrown at this boundary leaves as an ApiError. */
async function call<TResult>(run: () => Promise<TResult>, failure: string): Promise<TResult> {
  try {
    return await run();
  } catch (thrown) {
    throw normalizeError(thrown, failure);
  }
}

/** A wrong password is 401 here — the unlock screen's designed refusal, not a dead session. */
const UNLOCK_REJECTED_STATUS = 401;

/**
 * GET /admin/auth/bootstrap — version support and biometric opt-in (spec §6.1). `hasSession` is
 * decided by the hydrated session store either way (useSplashBoot reads the store, not this
 * payload): the server cannot know what this device still holds.
 */
export function bootstrapApp(signal?: AbortSignal): Promise<BootstrapResult> {
  return call(async () => {
    if (env.useMocks) return mockBootstrap(signal);
    const payload = unwrap(await adminBootstrap({ signal }), FAILURE.bootstrap);
    return {
      isVersionSupported: payload.isVersionSupported,
      hasSession: payload.hasSession,
      isBiometricEnabled: payload.isBiometricEnabled,
    };
  }, FAILURE.bootstrap);
}

/** POST /admin/auth/login — email + password, first factor only. There is no signup (spec §10.1). */
export function login(request: LoginRequest, signal?: AbortSignal): Promise<LoginOutcome> {
  return call(async () => {
    if (env.useMocks) return mockLogin(request, signal);
    // Flat body, additionalProperties:false — the four fields and nothing else.
    const result = await adminLogin({
      body: {
        email: request.email,
        password: request.password,
        deviceId: request.deviceId,
        deviceName: request.deviceName,
      },
      signal,
    });
    if (result.data !== undefined) return mapLoginResult(result.data);
    return loginFailureOutcome(result) ?? throwFailure(result, FAILURE.login);
  }, FAILURE.login);
}

/** POST /admin/auth/2fa — second factor plus device registration. */
export function verifyOtp(
  request: VerifyOtpRequest,
  signal?: AbortSignal,
): Promise<VerifyOtpOutcome> {
  return call(async () => {
    if (env.useMocks) return mockVerifyOtp(request, signal);
    const result = await adminVerifyOtp({
      body: {
        challengeId: request.challengeId,
        code: request.code,
        deviceId: request.deviceId,
        trustDevice: request.trustDevice,
      },
      signal,
    });
    if (result.data !== undefined) {
      return { status: "authenticated", session: mapAdminSession(result.data) };
    }
    return verifyFailureOutcome(result) ?? throwFailure(result, FAILURE.verify);
  }, FAILURE.verify);
}

/** POST /admin/auth/2fa/resend — a new code to the same number; only the latest one is valid. */
export function resendOtp(challengeId: string, signal?: AbortSignal): Promise<OtpChallenge> {
  return call(async () => {
    if (env.useMocks) return mockResendOtp(signal);
    const result = await adminResendOtp({ body: { challengeId }, signal });
    return mapOtpChallenge(unwrap(result, FAILURE.resend));
  }, FAILURE.resend);
}

/** DELETE /admin/auth/devices/{id} — frees a trust slot at the device limit (spec §5.3). */
export function revokeTrustedDevice(deviceId: string, signal?: AbortSignal): Promise<void> {
  return call(async () => {
    if (env.useMocks) return mockRevokeDevice(deviceId, signal);
    // One tap on Revoke is one intent, so the key is minted per call, not per network attempt.
    const result = await adminRevokeDevice({
      path: { id: deviceId },
      headers: { "Idempotency-Key": mintIdempotencyKey() },
      signal,
    });
    unwrap(result, FAILURE.revoke);
  }, FAILURE.revoke);
}

/**
 * POST /admin/auth/unlock — re-verifies the password behind a locked session (desktop BOX 58).
 * Locking is not signing out: the session survives, so this never starts a fresh 2FA round.
 */
export function unlockWithPassword(password: string, signal?: AbortSignal): Promise<UnlockOutcome> {
  return call(async () => {
    if (env.useMocks) return mockUnlockWithPassword(password, signal);
    const result = await adminUnlock({ body: { password }, signal });
    // 204 carries no body; the client still resolves `data` on success and `error` on failure.
    if (result.error === undefined) return { status: "unlocked" };
    if (result.response?.status === UNLOCK_REJECTED_STATUS) return { status: "invalidPassword" };
    return throwFailure(result, FAILURE.unlock);
  }, FAILURE.unlock);
}

/**
 * Device-local passcode check. This has no endpoint and must never grow one — an unlock passcode
 * is verified on the device, and in the real build by the OS behind the biometric plugin.
 */
export function unlockWithPasscode(passcode: string, signal?: AbortSignal): Promise<boolean> {
  return mockUnlockWithPasscode(passcode, signal);
}
