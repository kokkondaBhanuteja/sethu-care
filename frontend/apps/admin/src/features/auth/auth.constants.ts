/** Query and mutation keys for the auth feature. */
export const AUTH_QUERY_KEYS = {
  bootstrap: ["auth", "bootstrap"] as const,
};

/** Six digits, one row — the code has to read as a single run (design BOX 55). */
export const OTP_LENGTH = 6;

/** The device passcode is also six, but drawn smaller so it never reads as a login code (BOX 94). */
export const PASSCODE_LENGTH = 6;

/** Spec §5.2: five failed logins lock the account; §5.3: the idle lock fires at 30 minutes. */
export const IDLE_LOCK_MINUTES = 30;

/** Spec §5.4: two biometric failures fall back to passcode, three passcode failures re-login. */
export const BIOMETRIC_ATTEMPTS_BEFORE_PASSCODE = 2;
export const PASSCODE_ATTEMPTS_BEFORE_RELOGIN = 3;

/** Spec §5.3: the trusted-device cap that produces the device-limit picker (BOX 57 / BOX 91). */
export const MAX_TRUSTED_DEVICES = 3;

/**
 * Shown on the splash build stamp. A constant rather than `import.meta.env` because `lib/env.ts`
 * is the only reader of the environment; wire these to the release pipeline when OTA lands (§2.5).
 */
export const BUILD_STAMP = { version: "1.0.0", environment: "Production" } as const;

/**
 * Password reset never completes inside the app (spec §5.2) — it opens the web dashboard, which is
 * also the only place an admin account can be created.
 */
export const PASSWORD_RESET_URL = "https://admin.setucare.in/forgot-password";

/** Where the store link points for a blocked build. Replaced per-platform when Capacitor lands. */
export const APP_UPDATE_URL = "https://admin.setucare.in/download";

/** The splash waits this long before admitting it is slow — a 200ms "Connecting…" reads as jank. */
export const SLOW_BOOT_MS = 3_000;

/**
 * Mock triggers. Every designed failure state is reachable deterministically — see CLAUDE.md.
 * Server-side rules (rate limiting, lockout, attempt counting) are enforced by the backend; these
 * only make the *screens* reachable without one.
 */
export const MOCK_TRIGGERS = {
  lockedEmail: "locked@setucare.in",
  disabledEmail: "disabled@setucare.in",
  wrongPasswordSuffix: "wrong",
  trustedDeviceEmail: "trusted@setucare.in",
  wrongCode: "000000",
  expiredCode: "111111",
  deviceLimitCode: "999999",
  wrongPasscode: "000000",
} as const;

/** How long the mocked lockout has left, so the countdown in BOX 54 actually ticks. */
export const MOCK_LOCKOUT_SECONDS = 872;
