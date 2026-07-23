// Pure mappers from the generated admin auth payloads (@sethu/api-client) onto this feature's
// shapes — every field copied explicitly so a contract drift is a compile error here, not a
// mis-rendered screen at sign-in. Declared failure bodies: auth.api.errors.ts.

import type {
  AdminLoginResult as ApiAdminLoginResult,
  AdminLoginStatus as ApiAdminLoginStatus,
  AdminSession as ApiAdminSession,
  AuthTrustedDevice as ApiAuthTrustedDevice,
  OtpChallenge as ApiOtpChallenge,
} from "@sethu/api-client";
import type { Role } from "@sethu/core";

import { formatRelative } from "../../lib/format";
import { API_ERROR_CODES, apiError } from "../../lib/http/apiError";
import type { AuthSession, LoginOutcome, OtpChallenge, TrustedDevice } from "./auth.types";

/** The contract guarantees `role` is always ADMIN for this console (AdminSessionUser). */
const ADMIN_ROLE: Role = "ADMIN";

export function mapAdminSession(payload: ApiAdminSession): AuthSession {
  return {
    token: payload.token,
    user: {
      role: ADMIN_ROLE,
      name: payload.user.name,
      id: payload.user.id,
      email: payload.user.email,
      // The server sends null for "not scoped" — can() reads an ABSENT permissions as full
      // access (the v1 single-role behaviour), so null is dropped rather than defaulted to [],
      // which would lock the console.
      ...(payload.permissions ? { permissions: payload.permissions } : {}),
    },
  };
}

/** The wire vocabulary, pinned to the generated union so a contract rename is a compile error. */
const LOGIN_STATUS = {
  otpRequired: "otp_required",
  authenticated: "authenticated",
} as const satisfies Record<string, ApiAdminLoginStatus>;

/**
 * A login's 200 → the feature's outcome. `authenticated` only arrives on an already-trusted
 * device, which skips the second factor (spec §5.2). A status whose declared payload is missing
 * is a contract violation, not a designed state — it throws rather than half-signing-in.
 */
export function mapLoginResult(payload: ApiAdminLoginResult): LoginOutcome {
  if (payload.status === LOGIN_STATUS.authenticated && payload.session) {
    return { status: "authenticated", session: mapAdminSession(payload.session) };
  }
  if (payload.status === LOGIN_STATUS.otpRequired && payload.challenge) {
    return { status: "otpRequired", challenge: mapOtpChallenge(payload.challenge) };
  }
  throw apiError(API_ERROR_CODES.server, "The sign-in answer was missing its payload.");
}

export function mapOtpChallenge(payload: ApiOtpChallenge): OtpChallenge {
  return {
    challengeId: payload.challengeId,
    maskedMobile: payload.maskedMobile,
    expiresInSeconds: payload.expiresInSeconds,
    resendInSeconds: payload.resendInSeconds,
    attemptsRemaining: payload.attemptsRemaining,
  };
}

/**
 * A trust-slot row for the device-limit picker. The server sends `lastUsedAt` as an ISO stamp;
 * the row renders a scannable age ("just now", "2 days ago" becomes "17 Jul" past a day) because
 * the picker exists so an admin can spot the least-recently-used device without reading names.
 * `location` arrives "" today (no geo-IP on the backend) and is passed through — the row omits
 * the separator rather than dangling it.
 */
export function mapTrustedDevice(payload: ApiAuthTrustedDevice): TrustedDevice {
  return {
    id: payload.id,
    name: payload.name,
    type: payload.type,
    lastUsedLabel: formatRelative(payload.lastUsedAt),
    location: payload.location,
  };
}
