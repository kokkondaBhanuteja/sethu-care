import type { SessionUser } from "@sethu/core";

/** What the splash screen resolves before it routes (spec §6.1). */
export interface BootstrapResult {
  /** False routes to the blocking forced-update screen — an unsupported build misreports live state. */
  readonly isVersionSupported: boolean;
  readonly hasSession: boolean;
  /** A stored session plus biometric opt-in routes through /unlock rather than straight to /live. */
  readonly isBiometricEnabled: boolean;
}

/** A completed sign-in: the bearer token plus the account it belongs to. */
export interface AuthSession {
  readonly token: string;
  readonly user: SessionUser;
}

/** The pending second factor, carried from /login to /login/otp in router state. */
export interface OtpChallenge {
  readonly challengeId: string;
  /** Already masked by the server — the console never receives the full number. */
  readonly maskedMobile: string;
  readonly expiresInSeconds: number;
  readonly resendInSeconds: number;
  readonly attemptsRemaining: number;
}

export interface TrustedDevice {
  readonly id: string;
  readonly name: string;
  readonly type: DeviceType;
  readonly lastUsedLabel: string;
  readonly location: string;
}

export const DEVICE_TYPES = { phone: "phone", tablet: "tablet", desktop: "desktop" } as const;
export type DeviceType = (typeof DEVICE_TYPES)[keyof typeof DEVICE_TYPES];

/**
 * Login's designed outcomes as data rather than thrown errors.
 *
 * A rejected credential, a locked account and a disabled account are all *expected* answers with
 * their own screens (BOX 53/54/85), and two of them carry a payload the UI must render — the
 * lockout countdown especially. Only transport failures throw, and useAppForm renders those.
 */
export type LoginOutcome =
  | { readonly status: "otpRequired"; readonly challenge: OtpChallenge }
  | { readonly status: "authenticated"; readonly session: AuthSession }
  | { readonly status: "invalidCredentials" }
  | { readonly status: "locked"; readonly retryAfterSeconds: number }
  | { readonly status: "disabled" };

/** Two-factor's designed outcomes. Same reasoning as LoginOutcome. */
export type VerifyOtpOutcome =
  | { readonly status: "authenticated"; readonly session: AuthSession }
  | { readonly status: "invalidCode"; readonly attemptsRemaining: number }
  | { readonly status: "expired" }
  | { readonly status: "attemptsExhausted" }
  | { readonly status: "deviceLimit"; readonly devices: readonly TrustedDevice[] };

/** Re-authenticating a locked session (desktop BOX 58) — password only, never a new 2FA round. */
export type UnlockOutcome =
  { readonly status: "unlocked" } | { readonly status: "invalidPassword" };

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
  readonly deviceId: string;
  readonly deviceName: string;
}

export interface VerifyOtpRequest {
  readonly challengeId: string;
  readonly code: string;
  readonly trustDevice: boolean;
  readonly deviceId: string;
}
