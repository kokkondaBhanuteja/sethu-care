import { describe, expect, it } from "vitest";

import type {
  AdminLoginResult as ApiAdminLoginResult,
  AdminSession as ApiAdminSession,
  AuthTrustedDevice as ApiAuthTrustedDevice,
  OtpChallenge as ApiOtpChallenge,
} from "@sethu/api-client";

import { loginFailureOutcome, verifyFailureOutcome } from "./auth.api.errors";
import { mapAdminSession, mapLoginResult, mapOtpChallenge, mapTrustedDevice } from "./auth.api.map";

function session(overrides: Partial<ApiAdminSession> = {}): ApiAdminSession {
  return {
    token: "jwt.token.value",
    permissions: null,
    user: {
      id: "adm-1",
      name: "Demo Admin",
      email: "ops@setucare.in",
      role: "ADMIN",
    },
    ...overrides,
  };
}

const CHALLENGE: ApiOtpChallenge = {
  challengeId: "chl-1",
  maskedMobile: "+91 •••••00008",
  expiresInSeconds: 300,
  resendInSeconds: 30,
  attemptsRemaining: 3,
};

describe("mapAdminSession", () => {
  it("drops a null permissions so can() reads full access, and keeps a scoped list", () => {
    const full = mapAdminSession(session());
    // Absent, not [] — an empty array would lock the console (auth.types.ts).
    expect("permissions" in full.user).toBe(false);

    const scoped = mapAdminSession(session({ permissions: ["booking.cancel"] }));
    expect(scoped.user.permissions).toEqual(["booking.cancel"]);
  });

  it("carries token and identity field by field", () => {
    const mapped = mapAdminSession(session());
    expect(mapped.token).toBe("jwt.token.value");
    expect(mapped.user).toMatchObject({ role: "ADMIN", name: "Demo Admin", id: "adm-1" });
  });
});

describe("mapLoginResult", () => {
  it("maps otp_required with its challenge", () => {
    const outcome = mapLoginResult({
      status: "otp_required",
      challenge: CHALLENGE,
      session: null,
    });
    expect(outcome).toEqual({ status: "otpRequired", challenge: mapOtpChallenge(CHALLENGE) });
  });

  it("maps authenticated (a trusted device skipping the second factor)", () => {
    const outcome = mapLoginResult({
      status: "authenticated",
      session: session(),
      challenge: null,
    });
    expect(outcome.status).toBe("authenticated");
  });

  it("throws when a status arrives without its declared payload", () => {
    const broken: ApiAdminLoginResult = { status: "otp_required", challenge: null, session: null };
    expect(() => mapLoginResult(broken)).toThrowError();
  });
});

describe("mapTrustedDevice", () => {
  const device: ApiAuthTrustedDevice = {
    id: "dev-1",
    name: "Probe",
    type: "desktop",
    lastUsedAt: new Date().toISOString(),
    location: "",
  };

  it("keeps the desktop type and renders the ISO stamp as a scannable age", () => {
    const mapped = mapTrustedDevice(device);
    expect(mapped.type).toBe("desktop");
    expect(mapped.lastUsedLabel).toBe("just now");
    // "" passes through — the row omits the separator, the mapper never invents a place.
    expect(mapped.location).toBe("");
  });
});

describe("loginFailureOutcome", () => {
  it("maps the three designed refusals and refuses the rest", () => {
    const respond = (status: number, error?: unknown) => ({
      error,
      response: { status, statusText: "" },
    });

    expect(loginFailureOutcome(respond(401))).toEqual({ status: "invalidCredentials" });
    expect(loginFailureOutcome(respond(403))).toEqual({ status: "disabled" });
    expect(loginFailureOutcome(respond(423, { retryAfter: 872 }))).toEqual({
      status: "locked",
      retryAfterSeconds: 872,
    });
    // A lockout without its countdown is a contract violation — thrown, not guessed at 0.
    expect(loginFailureOutcome(respond(423, {}))).toBeNull();
    expect(loginFailureOutcome(respond(500))).toBeNull();
  });
});

describe("verifyFailureOutcome", () => {
  const respond = (status: number, error?: unknown) => ({
    error,
    response: { status, statusText: "" },
  });

  it("maps the four designed refusals", () => {
    expect(verifyFailureOutcome(respond(400, { attemptsRemaining: 2 }))).toEqual({
      status: "invalidCode",
      attemptsRemaining: 2,
    });
    expect(verifyFailureOutcome(respond(410))).toEqual({ status: "expired" });
    expect(verifyFailureOutcome(respond(423))).toEqual({ status: "attemptsExhausted" });
    expect(verifyFailureOutcome(respond(500))).toBeNull();
  });

  it("maps the device limit with its occupied trust slots", () => {
    const outcome = verifyFailureOutcome(
      respond(409, {
        devices: [
          {
            id: "dev-1",
            name: "iPhone 14",
            type: "phone",
            lastUsedAt: "2026-07-20T09:00:00Z",
            location: "Hyderabad",
          },
        ],
      }),
    );
    expect(outcome?.status).toBe("deviceLimit");
    if (outcome?.status === "deviceLimit") {
      expect(outcome.devices[0]).toMatchObject({ id: "dev-1", type: "phone" });
    }
  });

  it("refuses a device-limit body whose rows are malformed", () => {
    expect(verifyFailureOutcome(respond(409, { devices: [{ id: 1 }] }))).toBeNull();
  });
});
