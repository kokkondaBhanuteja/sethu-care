// TEMPORARY dev login bridge — delete when the contract's `adminLogin` lands.
//
// WHY: the real /ops endpoints require a Bearer token with role ADMIN, but the admin console's
// own auth (`adminLogin` in the contract) is still being implemented on the backend. Until it
// lands, a mocks-off run signs in through the backend's EXISTING phone-OTP auth using the seeded
// dev admin (env.devAdminPhone): POST /auth/otp echoes `dev_code` when the backend runs with
// SETHU_DEV_OTP=true, and POST /auth/verify exchanges it for a real ADMIN token. The designed
// email/password screens stay as chrome over this bridge — the typed credentials are ignored, and
// the flow completes on the designed trusted-device path (login → authenticated, no second
// factor). The replacement is one change: `login()` in auth.api.ts calls `adminLogin` instead of
// this function.
//
// The token and the dev code are never logged, never displayed and never persisted here — the
// token goes to the session store exactly as a real login's would.

import { requestOtp, verifyOtp } from "@sethu/api-client";

import { env } from "../../lib/env";
import { API_ERROR_CODES, apiError } from "../../lib/http/apiError";
import type { LoginOutcome } from "./auth.types";

/** `can()` reads an absent `permissions` as "not scoped" — the v1 single-role full access. */
const ADMIN_ROLE = "ADMIN";

export async function devBridgeLogin(signal?: AbortSignal): Promise<LoginOutcome> {
  const otpResult = await requestOtp({ body: { phone: env.devAdminPhone }, signal });
  if (otpResult.data === undefined) throw otpResult.response;

  const devCode = otpResult.data.dev_code;
  if (!devCode) {
    throw apiError(
      API_ERROR_CODES.server,
      "The backend did not echo a dev OTP code. Run it with SETHU_DEV_OTP=true, or wait out the 30s per-phone OTP rate limit.",
      { status: 501 },
    );
  }

  const verifyResult = await verifyOtp({
    body: { phone: env.devAdminPhone, code: devCode },
    signal,
  });
  if (verifyResult.data === undefined) throw verifyResult.response;

  const { token, role, name } = verifyResult.data;
  if (!token || role !== ADMIN_ROLE) {
    // A token without the ADMIN role would only 403 on every /ops read — refuse the sign-in
    // instead, through the designed rejected-credential screen.
    return { status: "invalidCredentials" };
  }

  return {
    status: "authenticated",
    session: { token, user: { role: ADMIN_ROLE, name: name ?? "Admin" } },
  };
}
