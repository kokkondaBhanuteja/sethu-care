// Stand-in for the auth endpoints the backend does not expose yet (docs/admin-api-contract.md,
// "MISSING — auth"). Every designed failure state has a deterministic trigger so a reviewer can
// walk all of them without a server — the trigger table is in this folder's CLAUDE.md.
//
// Nothing here is a security control. Lockout, attempt counting and rate limiting are
// SERVER-enforced (spec §5.8); these mocks only make the screens that render those answers
// reachable. Passwords and passcodes are compared and discarded — never logged, never stored.

import { mockRead, mockWrite } from "../../mocks/mockTransport";
import { MOCK_LOCKOUT_SECONDS, MOCK_TRIGGERS } from "./auth.constants";
import { DEVICE_TYPES } from "./auth.types";
import type {
  AuthSession,
  BootstrapResult,
  LoginOutcome,
  LoginRequest,
  OtpChallenge,
  TrustedDevice,
  UnlockOutcome,
  VerifyOtpOutcome,
  VerifyOtpRequest,
} from "./auth.types";

const MOCK_ADMIN: AuthSession["user"] = {
  role: "ADMIN",
  name: "Ravi Kumar",
  id: "adm_ravi",
  email: "ravi@setucare.in",
  // permissions deliberately absent: v1 is a single role with full access (spec §10.1), and
  // `can()` reads "not scoped" as "everything". Sending [] here would lock the console instead.
};

const MOCK_SESSION: AuthSession = { token: "mock.admin.token", user: MOCK_ADMIN };

const MOCK_CHALLENGE: OtpChallenge = {
  challengeId: "chl_mock",
  maskedMobile: "+91 •••••43210",
  expiresInSeconds: 277,
  resendInSeconds: 24,
  attemptsRemaining: 3,
};

const MOCK_TRUSTED_DEVICES: readonly TrustedDevice[] = [
  {
    id: "dev_iphone14",
    name: "iPhone 14",
    type: DEVICE_TYPES.phone,
    lastUsedLabel: "now",
    location: "Hyderabad",
  },
  {
    id: "dev_pixel7",
    name: "Pixel 7",
    type: DEVICE_TYPES.phone,
    lastUsedLabel: "2 days ago",
    location: "Hyderabad",
  },
  {
    id: "dev_ipadair",
    name: "iPad Air",
    type: DEVICE_TYPES.tablet,
    lastUsedLabel: "18 days ago",
    location: "Secunderabad",
  },
];

export function mockBootstrap(signal?: AbortSignal): Promise<BootstrapResult> {
  return mockRead<BootstrapResult>(
    () => ({ isVersionSupported: true, hasSession: false, isBiometricEnabled: false }),
    { ...(signal ? { signal } : {}) },
  );
}

export function mockLogin(request: LoginRequest, signal?: AbortSignal): Promise<LoginOutcome> {
  return mockWrite<LoginOutcome>(
    () => {
      const email = request.email.trim().toLowerCase();

      if (email === MOCK_TRIGGERS.lockedEmail) {
        return { status: "locked", retryAfterSeconds: MOCK_LOCKOUT_SECONDS };
      }
      if (email === MOCK_TRIGGERS.disabledEmail) return { status: "disabled" };
      if (request.password.toLowerCase().endsWith(MOCK_TRIGGERS.wrongPasswordSuffix)) {
        return { status: "invalidCredentials" };
      }
      // A device the server already trusts skips the second factor entirely (spec §5.2).
      if (email === MOCK_TRIGGERS.trustedDeviceEmail) {
        return { status: "authenticated", session: MOCK_SESSION };
      }

      return { status: "otpRequired", challenge: MOCK_CHALLENGE };
    },
    {
      ...(signal ? { signal } : {}),
    },
  );
}

export function mockVerifyOtp(
  request: VerifyOtpRequest,
  signal?: AbortSignal,
): Promise<VerifyOtpOutcome> {
  return mockWrite<VerifyOtpOutcome>(
    () => {
      if (request.code === MOCK_TRIGGERS.expiredCode) return { status: "expired" };
      if (request.code === MOCK_TRIGGERS.deviceLimitCode) {
        return { status: "deviceLimit", devices: MOCK_TRUSTED_DEVICES };
      }
      if (request.code === MOCK_TRIGGERS.wrongCode) {
        return { status: "invalidCode", attemptsRemaining: 2 };
      }
      return { status: "authenticated", session: MOCK_SESSION };
    },
    {
      ...(signal ? { signal } : {}),
    },
  );
}

export function mockResendOtp(signal?: AbortSignal): Promise<OtpChallenge> {
  return mockWrite<OtpChallenge>(() => ({ ...MOCK_CHALLENGE, challengeId: "chl_mock_resent" }), {
    ...(signal ? { signal } : {}),
  });
}

export function mockRevokeDevice(deviceId: string, signal?: AbortSignal): Promise<void> {
  return mockWrite<void>(
    () => {
      if (!MOCK_TRUSTED_DEVICES.some((device) => device.id === deviceId)) {
        throw new Error(`Unknown device ${deviceId}`);
      }
    },
    {
      ...(signal ? { signal } : {}),
    },
  );
}

export function mockUnlockWithPassword(
  password: string,
  signal?: AbortSignal,
): Promise<UnlockOutcome> {
  return mockWrite<UnlockOutcome>(
    () =>
      password.toLowerCase().endsWith(MOCK_TRIGGERS.wrongPasswordSuffix)
        ? { status: "invalidPassword" }
        : { status: "unlocked" },
    { ...(signal ? { signal } : {}) },
  );
}

/**
 * The device passcode is verified by the OS in the real build. Until the biometric plugin lands
 * this compares locally so the passcode screen (BOX 94) is walkable; it grants nothing on its own.
 */
export function mockUnlockWithPasscode(passcode: string, signal?: AbortSignal): Promise<boolean> {
  return mockWrite<boolean>(() => passcode !== MOCK_TRIGGERS.wrongPasscode, {
    ...(signal ? { signal } : {}),
  });
}
