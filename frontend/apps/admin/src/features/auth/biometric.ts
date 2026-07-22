// Biometric unlock (spec §5.4).
//
// ┌── PLUGIN INTEGRATION POINT ────────────────────────────────────────────────────────────────┐
// │ The spec names `@capacitor-community/biometric-auth` (Face ID, Touch ID, Android            │
// │ BiometricPrompt). It is NOT installed, and nothing here adds it.                            │
// │                                                                                             │
// │ To wire it, replace the two function bodies below — no caller changes:                      │
// │   isBiometricAvailable() → await BiometricAuth.checkBiometry() → `isAvailable`              │
// │   requestBiometricUnlock() → await BiometricAuth.authenticate({ reason, cancelTitle })       │
// │       resolves        → BIOMETRIC_RESULTS.success                                            │
// │       BiometryError   → `notRecognised` for a failed match, `unavailable` for no hardware    │
// │                          or no enrolment, `cancelled` when the sheet is dismissed            │
// │                                                                                             │
// │ The plugin returns a boolean and nothing else: biometrics never leave the device and are     │
// │ never transmitted. The session token stays in `@capacitor/preferences` behind the OS         │
// │ keystore — this module must never see it.                                                   │
// └─────────────────────────────────────────────────────────────────────────────────────────────┘

export const BIOMETRIC_RESULTS = {
  success: "success",
  /** The sensor read a finger or face and refused it. */
  notRecognised: "notRecognised",
  /** No hardware, no enrolment, or the enrolment changed at OS level — fall through to passcode. */
  unavailable: "unavailable",
  /** The admin dismissed the prompt. The app stays locked; content never leaks. */
  cancelled: "cancelled",
} as const;

export type BiometricResult = (typeof BIOMETRIC_RESULTS)[keyof typeof BIOMETRIC_RESULTS];

export function isBiometricAvailable(): Promise<boolean> {
  return Promise.resolve(false);
}

/**
 * Fires automatically on mount and again from the retry button. Without the plugin there is no
 * sensor to ask, so it reports `unavailable` and the screen falls through to the passcode — which
 * is exactly the path a device with no enrolment takes in production.
 */
export function requestBiometricUnlock(): Promise<BiometricResult> {
  return Promise.resolve(BIOMETRIC_RESULTS.unavailable);
}
