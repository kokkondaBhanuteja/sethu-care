# apps/admin/src/features/settings

Scope: the settings family — the mobile More menu, notification settings, security & devices, admin
profile, help & support, sign-out, the desktop payouts screen, and the read-only summaries the
"Best on desktop" notice shows. Nothing operational lives here.

Purpose: Admin spec §6.22, §6.30–§6.34, plus §5.6 (data protection on device) and §5.7 (the
lost-device runbook). Designs: desktop BOX 59–67, mobile BOX 95–109.

## The IA (desktop: one unified Settings area)

Desktop no longer renders four scattered screens. Every account-family route mounts the same
frame — `SettingsShell` — so the area reads as ONE place:

```
Settings (PageHeader h1 + one-line lead)
├── sub-nav (left, active pill)         SETTINGS_SECTIONS in settings.constants.ts
│     Profile              /profile
│     Notifications        /settings/notifications
│     Security & devices   /settings/security
│     Help & about         /support
└── section content (right)             icon-headed SettingsGroup cards, led by the
                                        section's icon + h2 + one-line description
```

Routes are unchanged — deep links keep working; the frame highlights whichever section the URL
belongs to. Mobile keeps the More-menu pattern (BOX 95) with the same clarity applied: every
group states what it is for (`SettingsGroup description`), every screen leads with its section
description (`SettingsLead`).

## The visual family

Every screen here is the same thing: grouped white cards floating on the recessed grey canvas.

- Mobile: `MobileAppBar … onSurface` + `<div className="screen__scroll bg-surface">` +
  `SettingsLead` as the first line.
- Desktop: `SettingsShell` (Topbar crumbs + PageMain/PageHeader + `SettingsSectionNav` +
  section header), optionally with a `SettingsAside` floating right of the column.
- Inside both: `SettingsGroup` (with `icon` + `description`) → `SettingsCard` → `SettingsRow` /
  `SettingsSwitchRow` / `SettingsNote`, with `SettingsGroup`'s `foot` for a line about the group.

Do not invent a second treatment. A new settings screen composes these components, and a new
desktop settings screen goes INSIDE `SettingsShell` with its own entry in `SETTINGS_SECTIONS`.

## Contents

| File                                                          | Responsibility                                                    |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| `SettingsShell.tsx` + `SettingsSectionNav.tsx`                | The unified desktop frame and its left sub-nav (active pill).     |
| `SettingsGroup.tsx` · `SettingsRow.tsx` · `SettingsSwitchRow.tsx` | The group/card/row/note/lead kit the whole family is built from. `SettingsRow`'s `leading` slot carries the device identity chip. |
| `SettingsAside.tsx`                                           | The explainer that floats beside the reading column (BOX 60).     |
| `ChoiceSheet.tsx`                                             | The picker behind every value-plus-chevron row.                   |
| `MoreMenu.mobile.tsx` + `MoreMenuIdentity` + `MoreMenuSection` | BOX 95, with one-line group descriptions.                        |
| `SignOutConfirm.tsx` + `useSignOut.ts`                        | BOX 67 (modal) / BOX 96 (sheet).                                  |
| `NotificationSettings.{desktop,mobile}.tsx`                   | BOX 60/61 and BOX 97–100.                                         |
| `NotificationGroups` · `CriticalChannelGroup` · `NotificationChannelGroup` · `NotificationScheduleGroups` | The six groups, shared by both surfaces. With `withDetails` (desktop) every configurable switch states its one-line consequence. |
| `NotificationDeliveryBanner.tsx`                              | The permission-denied, critical-channel-off and quiet-hours bands. |
| `useNotificationPermission.ts`                                | Can an alert actually reach this admin.                           |
| `SecuritySettings.{desktop,mobile}.tsx` + `TrustedDeviceList` (identity rows, BOTH surfaces) + event list/table | BOX 62/63 and BOX 101/102. |
| `RevokeDeviceDialog.tsx`                                      | The confirm for revoking any device, including this one.          |
| `LostDeviceSteps.tsx`                                         | Spec §5.7, expanded on desktop, in a sheet on mobile.             |
| `AdminProfile.{desktop,mobile}.tsx` + `ProfileDetails` · `ProfileActivity` · `ProfilePreferences` | BOX 64 / 103.                          |
| `HelpSupport.{desktop,mobile}.tsx` + `HelpFaqGroup` · `HelpSupportGroups` (get-help / diagnostics / legal, shared) · `HelpVersionCard` · `useDiagnostics.ts` | BOX 65 / 104. |
| `PayoutsScreen.tsx` + `PayoutsTable` · `PayoutTotals` · `usePayouts.ts` | BOX 66. Desktop-only; NOT part of the Settings area (finance, not account) — it keeps its own Topbar frame. |
| `DesktopOnlySummary.tsx`                                      | The read-only card for BOX 105–109.                               |
| `settings.{api,mock,fixtures,types,constants,time}.ts`        | The data boundary, fixtures, vocabularies, IST clock helpers, and `SETTINGS_SECTIONS`. The settings endpoints are REAL (backend `internal/adminaccount`); with `VITE_USE_MOCKS=false` every read is sdk call → pure mapper → feature types and every write sends an `Idempotency-Key`. The mock branch is untouched. **Payouts is the exception — the backend answers 501 (2026-07-23), so it stays mock-backed on both branches.** |
| `settings.api.map.ts` · `settings.api.requests.ts` · `settings.api.errors.ts` | Responses → feature types and inputs → generated bodies, field by field so drift is a compile error; the failure seam (`unwrap` → `ApiError`). The 422s (diagnostics PII, a critical channel in a notification PUT) surface via the status-derived `validation` code. |
| `SettingsShell.test.tsx` · `SettingsGroup.test.tsx`           | The frame contract (one h1, section h2, active pill) and the group anatomy. |

## Business logic

**Toggles save immediately.** Every switch and every picker fires an optimistic mutation and rolls
back on failure. There is no Save button anywhere in this folder, because the design shows a switch
and a switch that waits for a round trip reads as broken. The failure toast is raised once,
centrally, by the mutation cache in `lib/query/queryClient.ts` — feature code only rolls back.

**The critical tier is not a preference.** `CRITICAL_CHANNELS` carries no stored value: those four
rows render a lock, and `NotificationSettings.channels` only ever contains the configurable tier. A
PATCH must never be able to disable one.

**Delivery detection** (`useNotificationPermission`). Two states matter and both are dangerous:

- `permissionDenied` — read from `Notification.permission` on web. Every configurable switch below
  the banner goes inert, because none of them can do anything.
- `criticalChannelOff` — permission granted but the OS-level Critical Alerts channel is off
  (Android). Spec §6.30 calls this the most dangerous state the app can be in. The web platform
  cannot report it; **the Capacitor integration point is commented in that hook** — the Android
  channel importance replaces the second branch of `readBrowserPermission` and nothing else moves.
  The dependency is deliberately not added yet.

**Quiet hours** (`settings.time.ts`). The window is IST wall-clock and normally wraps midnight, so
`isQuietHoursActive` handles the wrap explicitly. Critical alerts break through it, and the in-card
note says so — an admin who does not know that will not configure a window at all.

**Revoking a device** is `device.revoke` in the action registry: high risk, step-up, no reason code,
no undo. `useSecuritySettings` reads that policy through `useActionPolicy`/`useStepUp` rather than
restating it. Revoking the CURRENT device signs out and clears the whole QueryClient.

**Sign-out destroys everything** (spec §5.6). `useSignOut` calls `useSession().signOut()` **and**
`queryClient.clear()`. Dropping the token alone would leave the previous admin's bookings, roster and
customer PII in memory for whoever signs in next; a revoked device must retain nothing.

**Masked values only.** The phone number arrives masked from the server and is rendered as-is. No
payment instrument is ever displayed beyond a masked reference, and no token is ever logged.

**Sign-out and revoke close bookkeeping, not the token.** Sessions are stateless JWTs, so
`adminLogout` and `adminRevokeDevice` end the server-side record while the token technically lives
to its TTL. `useSignOut` therefore calls the server best-effort and treats the LOCAL destruction
(token + `queryClient.clear()`) as the load-bearing act; revoking the current device signs out
locally only after the server confirms. Two copy strings overpromise against this model and are
flagged rather than silently reworded: `security.revokeOtherBody` ("signed out immediately … wiped
on next contact") and the diagnostics consent note ("the last 200 network events" — the console
keeps no such buffer yet; `logs`/`networkEvents` upload honestly empty).

## Real mode — what the live backend actually sends

`GET /admin/settings/notifications` carries the configurable tier only — the critical channels
have no slot in the payload, so the locked rows stay static by construction; `criticalSound`
arrives `"default"` and renders as sent. `SecuritySettings.devices[].kind` has **no `desktop`
value** (a contract quirk — the auth trust list's `DeviceType` does), so a desktop session
arrives as a `tablet`-glyph row; device `location` is `""` (no geo-IP) and the row drops its
separator (`security.deviceMetaNoLocation`) instead of dangling it; event `location` is `null`
and renders the designed "unknown". Profile activity's acknowledge metrics are honest zeros, the
queued-actions count is an honest 0, and `/admin/version` returns honest statics ("unknown") until
a build pipeline stamps them. `defaultLandingRoute` travels as an absolute route (`"/live"` — a
bare id is a 422, "must be an absolute route") while the landing picker's vocabulary is tab ids —
the read mapper strips the slash, the request builder restores it. Diagnostics answers 202 with a receipt; a 422 means the payload carried
customer PII and surfaces as `support.diagnosticsRejected`, never a silent retry.

## Mock triggers (dev)

`VITE_MOCK_MODE=error|empty|slow` drives loading, error and empty for every read here. The two
notification states the OS owns are not reachable that way, so they are forced from the URL:

| URL                                          | State                                  |
| -------------------------------------------- | -------------------------------------- |
| `/settings/notifications?notify=denied`      | BOX 61 / 98 — permission denied        |
| `/settings/notifications?notify=channel-off` | BOX 99 — critical channel off          |
| `/settings/notifications?notify=quiet`       | BOX 100 — quiet hours active           |

Without the parameter, quiet hours shows itself whenever the configured window is genuinely running,
and the permission banner follows the real browser permission. The override is read from the URL and
never persisted.

## Dependencies

`components/ui/*`, `components/states/QueryBoundary`, `layouts/{MobileAppBar,Topbar,PageMain}`,
`layouts/navigation.constants` (the tab list, for the default-landing picker), `lib/{format,forms,
permissions,toast,http,cx}`, `hooks/{useBreakpoint,useStepUp}`, `queries/useShellCounters`,
`routes/routes.constants`, `mocks/mockTransport`, `@sethu/{core,i18n}`, `@sethu/ui-web`
(PageHeader + IconChip in `SettingsShell`).

## Boundaries

- No sibling-feature imports. The More menu links to other features by route only.
- Data reaches a screen through `settings.api.ts` and a query hook — never a mock import.
- i18n namespace is `adminSettings`. Shared words (Cancel, Done, Retry) come from `adminShell`.
- Payouts is the only screen here that touches money. It formats paise through `lib/format` and does
  no arithmetic on it. Running a cycle is desktop-only by product rule (§1.5), not by layout.

## Impacted modules

The More menu is the mobile entry point to Customers, Tickets, Analytics and the Audit log; changing
`MORE_*_ITEMS` changes what is reachable from a phone. `useSignOut` is the app's only logout path.
