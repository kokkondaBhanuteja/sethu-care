# apps/admin/src/features/auth

Scope: Everything before the console exists — splash and routing decision, forced update, login,
two-factor, the trusted-device limit, and the resume-from-lock screens. Spec §5 (Authentication &
Security) and §6.1–6.4. Designs: desktop BOX 51–58, mobile BOX 79–94.

Purpose: Get a provisioned admin to the destination they were actually trying to reach, and keep a
walked-away-from device from leaking live operations data.

## Contents

| File | What it is |
| --- | --- |
| `SplashScreen.tsx` · `useSplashBoot.ts` | BOX 51 / 79–81. Bootstrap, then route. Slow and fatal states. |
| `ForcedUpdateScreen.tsx` | BOX 82. Blocking, one exit. |
| `LoginScreen.tsx` · `LoginForm.tsx` · `useLogin.ts` | BOX 52–54 / 83–87. Email + password. |
| `OtpScreen.desktop.tsx` · `OtpScreen.mobile.tsx` · `OtpFields.tsx` · `useOtpVerify.ts` | BOX 55–56 / 88–90. |
| `DeviceLimitPicker.tsx` | BOX 57 / 91. The trusted-device cap. |
| `SessionLock.desktop.tsx` · `useSessionLock.ts` | BOX 58. Desktop's password step-up. |
| `BiometricUnlock.mobile.tsx` · `useUnlock.ts` · `biometric.ts` | BOX 92–94. Sensor, then passcode. |
| `CodeInput.tsx` | The six-cell code control. **Promotion candidate — see below.** |
| `auth.api.ts` · `auth.mock.ts` · `auth.types.ts` · `auth.constants.ts` | The data boundary. The admin auth endpoints are REAL (backend `internal/adminaccount`); with `VITE_USE_MOCKS=false` every call is sdk call → pure mapper → the same outcome types the mocks produce. The mock branch is untouched. |
| `auth.api.map.ts` · `auth.api.errors.ts` | Payloads → feature types, field by field so drift is a compile error; and the DECLARED failure bodies → outcomes-as-data: login 401/403/423 → invalidCredentials/disabled/locked{retryAfter}, 2fa 400/410/423/409 → invalidCode{attemptsRemaining}/expired/attemptsExhausted/deviceLimit{devices}. Resend's 429 budget throws `rate_limited` and the screen shows `otp.resendFailed` in place — the 429's `resetAt` has no slot on ApiError, the same trade-off booking-actions made. |
| `authRouterState.ts` · `useCountdown.ts` · `useIsOnline.ts` · `deviceIdentity.ts` | Support. The device id is minted once and persisted through the `@sethu/core` storage adapter (`sethu.admin.deviceId` — the same adapter as the session token), so a reload is the same device and does not burn a trust slot. `getDeviceId()` is async for that reason. |

`layouts/AuthLayout.tsx` is the pre-auth shell this feature renders into — three frames (`split`,
`centred`, `lock`). It lives in `layouts/` because it owns `.app` / `.screen` / `.auth-split__*` /
`.modal-card`, and only `components/ui/*` and `layouts/*` may name those classes.

## Business logic

- **No self-signup, ever** (spec §10.1). No "Create account", no social login, no in-app password
  reset. The provisioning note under the form is the deliberate replacement for the link a consumer
  app would put there; `PASSWORD_RESET_URL` opens the web dashboard in a new tab.
- **Deep-link resume** (spec §3.4 rule 1). `RequireAuth` redirects with `state: { from: location }`;
  `authRouterState.ts` carries that through login → two-factor → `resumePath()`. Never `/live` when a
  destination was captured — the reason the app was opened is usually a push about a booking on fire.
- **Nothing here is a security control.** Attempt counting, lockout, rate limiting and the
  trusted-device cap are server-enforced (spec §5.8). These screens render the server's answers, and
  the designed failures arrive as *data* (`LoginOutcome`, `VerifyOtpOutcome`) rather than as thrown
  errors, because two of them carry a payload the UI must show.
- **Passwords and passcodes** are never logged, never persisted, never put in a query key, and never
  autofilled into a non-password input. Paste is permitted — blocking it discourages password
  managers, which is a net loss (spec §6.2).
- **The admin OTP is not the booking OTP.** No shared code path, no shared storage. Confusing them
  would mean an admin reading their own login code to a provider.
- `role: "ADMIN"`, `permissions` deliberately **absent** — `can()` reads "not scoped" as full access,
  which is the v1 single-role behaviour. Sending `[]` would lock the console.

## Real mode — the live flow (VITE_USE_MOCKS=false)

The full designed flow runs against the seeded dev admin: **`ops@setucare.in` / `password123`**,
then OTP **`123456`** on the two-factor screen (a static demo code, exempt from the SMS rate
limits). The session token goes to the session store exactly as the mocks' would; the api-client
interceptor reads it from there. What the live backend actually sends today:

- Trust-slot rows (`DeviceLimitError.devices`, `GET /admin/auth/devices`) carry `lastUsedAt` as an
  ISO stamp — mapped to the scannable age the row was designed around — and `location: ""` (no
  geo-IP), so the row drops its separator rather than dangling it (`devices.lastUsedNoLocation`).
- The auth trust list's `DeviceType` includes `desktop`; the settings screen's `DeviceKind` does
  NOT — the same physical desktop appears as `desktop` here and as a `tablet`-glyph row there
  (see `features/settings/CLAUDE.md`).
- The trusted-device cap is genuinely 3 (`MAX_TRUSTED_DEVICES` mirrors it): repeated logins with
  `trustDevice` on mint real trust slots, and the fourth login lands on the designed device-limit
  picker. `adminBootstrap` returns honest statics; the splash still derives `hasSession` from the
  hydrated session store, not from the payload.
- `adminRefreshSession` exists on the backend but has no consumer here yet — sessions are
  stateless JWTs that live to their TTL, and no screen re-arms one today. Wire it before any
  long-lived kiosk use.

## Walking every state (mock triggers)

Mocks are on by default (`VITE_USE_MOCKS=true`). Any plausible email plus any password of 8+
characters signs in successfully. The triggers live in `MOCK_TRIGGERS` (`auth.constants.ts`):

| To see | Do this |
| --- | --- |
| Login: wrong password (BOX 53 / 84) | Any email, password **ending in `wrong`** (e.g. `hunterwrong`). |
| Login: account locked (BOX 54 / 85) | Email `locked@setucare.in`. Countdown starts at 14:32. |
| Login: account disabled | Email `disabled@setucare.in`. |
| Login: submitting (BOX 86) | `VITE_MOCK_MODE=slow` — 3s in flight. |
| Login: offline (BOX 87) | Go offline in devtools. Banner pins, form goes inert. |
| Login: transport failure | Point `VITE_USE_MOCKS=false` at a stopped backend — fetch rejects, the network strip shows. |
| Two-factor (BOX 55 / 88) | Any other email. Code `123456` (or any 6 digits) signs in. |
| Two-factor: wrong code (BOX 56 / 89) | Code `000000`. Cells clear, focus returns to the first. |
| Two-factor: code expired (BOX 90) | Code `111111`, or wait out the 4:37 expiry countdown. |
| Two-factor: device limit (BOX 57 / 91) | Code `999999`. Revoking a device auto-retries the code. |
| Trusted device, no 2FA at all | Email `trusted@setucare.in` — goes straight to the destination. |
| Splash: slow connection (BOX 80) | `VITE_MOCK_MODE=slow` — "Connecting…" after 3s. |
| Splash: fatal error (BOX 81) | `VITE_MOCK_MODE=error`. |
| Forced update (BOX 82) | Flip `isVersionSupported` to `false` in `mockBootstrap`. |
| Biometric unlock (BOX 92) | Visit `/unlock` on a phone width. |
| Biometric: not recognised (BOX 93) | Automatic — the plugin is absent, so the sensor reports unavailable. |
| Biometric: passcode entry (BOX 94) | Tap **Use passcode**. Wrong passcode: `000000`. Three wrong → sign-in. |
| Session lock (BOX 58) | Visit `/unlock` at desktop width. Wrong password: anything ending in `wrong`. |

`/unlock` renders the desktop password lock above 768px and biometric unlock below it — a browser
has no fingerprint sensor, so the two shells run different step-ups for the same purpose.

## Dependencies

`@sethu/core` (`useSession`), `@sethu/i18n` (`adminAuth`, plus `adminShell` for shared words),
`@tanstack/react-query` (splash bootstrap only), `zod` + `lib/forms/useAppForm`, `lib/http/apiError`,
`routes/routes.constants`, `layouts/AuthLayout`, `layouts/MobileAppBar`, `components/ui/*`.

## Boundaries

- No feature imports. Nothing outside `auth.api.ts` touches `auth.mock.ts`.
- No route string is written here — everything goes through `ROUTES`.
- `biometric.ts` is the **only** place the biometric plugin will be wired. The plugin
  (`@capacitor-community/biometric-auth`) is **not installed**; the file documents the exact
  replacement for its two functions and nothing else changes.

## Known gaps

1. **`TextInput` has no `invalid` prop.** BOX 53 marks *both* fields red without saying which was
   wrong; today only the alert strip carries the signal. A one-prop change to
   `components/ui/form/TextInput.tsx` restores it (`useLogin` already exposes `alert.marksFields`).
2. **`TextInput` has no `adornmentEnd` prop.** The show/hide-password eye is drawn inside the input
   in BOX 52; it renders as a text toggle under the field instead.
3. **`CodeInput` belongs in `components/ui/form/`.** It is a design-system control and the only file
   outside `components/ui` / `layouts` that names a `components.css` class. Move it as-is.
4. **The lock screen has nothing behind it.** The design blurs the dashboard the admin left; that
   requires the shell to render the lock over the live route rather than routing to `/unlock`.
5. **`formatClock` (mm:ss) lives here, not in `lib/format`.** Promote it when a second feature needs
   a clock-form countdown; `formatDuration` renders ages (`14m 32s`), which is a different job.
6. **The sdk-result seam is triplicated.** `unwrap`/`SdkResult`/`mintIdempotencyKey` exist here, in
   `features/settings` and in `features/booking-actions`, because features cannot import siblings —
   promote the seam to `lib/http` and delete the copies.

Impacted modules: every authenticated route depends on this feature completing a session.
