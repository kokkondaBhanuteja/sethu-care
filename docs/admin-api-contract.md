# Admin Console — API contract

**Status:** the frontend is built against this contract. Everything marked **MISSING** is served by a
typed mock in `frontend/apps/admin/src/features/<feature>/<feature>.mock.ts` today.

This document is the backend's work list. Each mock's TypeScript types are the normative shape — if
this document and `<feature>.types.ts` disagree, the types win and this document should be corrected.

## What exists today

`backend/api/openapi.yaml` exposes six endpoints the console can use now:

| Method | Path                            | Used by                              |
| ------ | ------------------------------- | ------------------------------------ |
| GET    | `/ops/assignment-queue`         | Needs-attention feed, Live dashboard |
| GET    | `/ops/bookings/{id}/candidates` | Assign / reassign (rescue)           |
| POST   | `/ops/bookings/{id}/assign`     | Assign / reassign (rescue)           |
| GET    | `/ops/technicians`              | Provider roster                      |
| GET    | `/ops/payments`                 | Payouts (desktop-only)               |
| GET    | `/ops/cash-reconciliation`      | Payouts (desktop-only)               |

Everything below is missing.

## Conventions the console assumes

- **Auth**: `Authorization: Bearer <jwt>`, admin role. A `401` clears the session and routes to
  `/login` centrally — no endpoint needs its own handling.
- **Errors**: JSON body `{ "code": string, "message": string, "fields"?: { [field]: string } }`.
  The console maps status → `ApiError.code` (`400/422 → validation`, `401 → unauthorized`,
  `403 → forbidden`, `404 → not_found`, `409 → conflict`, `429 → rate_limited`, `5xx → server`).
- **Money**: paise (`int64`), always. The console formats; it never does float arithmetic.
- **Timestamps**: RFC 3339 UTC. The console renders IST.
- **Pagination**: `?limit=&cursor=`, response `{ items: [...], total: number, nextCursor?: string }`.
  The design paginates by count line plus "Load more", so a cursor is sufficient — no page numbers.
- **Optimistic concurrency**: every mutable record carries `version`. Mutations send it back and a
  stale version returns `409`, which the console renders as "someone else just changed this" (the
  design has a dedicated state for it).
- **Reason codes**: high- and critical-risk mutations require `{ reasonCode, reasonNote }`. The
  vocabulary must be a backend enum mirrored into `@sethu/domain`, never free strings.
- **Idempotency**: every mutation below should accept `Idempotency-Key`. The console generates one
  per submit attempt; without it a retried refund is a duplicate refund.

## MISSING — shell

| Method | Path                  | Returns                                                                                                                                                   |
| ------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/ops/shell-counters` | `{ criticalAlerts, needsAttention, pendingApplications, openTickets }` — drives every navigation badge. Alerts count is **unacknowledged critical only**. |

## MISSING — live dashboard & needs-attention (spec §6.5, §6.6)

Normative shapes: `frontend/apps/admin/src/features/dashboard/dashboard.types.ts`.

| Method | Path                        | Notes                                                                                                                                                                                                                                                                                             |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/ops/dashboard/summary`    | `?period=today\|live_now`. Bookings, revenue (paise), completion rate (0–1), mean assign time (ms) — each with a **signed delta against the same period yesterday and an `isGood` flag**, because trend colour is semantic, not directional. Plus eight sparkline points per metric. |
| GET    | `/ops/dashboard/band`       | `{ criticalCount, examples[] }` — unacknowledged criticals only, at most two examples. Separate from `summary` on purpose: alerts arrive on their own channel and must not wait for a slow metrics query.                                                                          |
| GET    | `/ops/dashboard/attention`  | `?filter=all\|escalated\|unassigned\|sla\|delayed&limit=&cursor=`. **The server owns the priority order** (spec §6.6 tiers, oldest first within a tier) — the client never re-sorts. Returns per-filter counts for the chips, plus `healthyJobs` and `lastCleared` for the all-clear state. |
| GET    | `/ops/activity`             | `?limit=` — the last N state transitions as `{ id, bookingRef, kind, providerName, at }`. `kind` must be an enum, not a prose sentence: the console localises it.                                                                                                                  |

`POST /ops/alerts/{id}/acknowledge` (listed under alerts below) is the one mutation these screens
perform themselves. It must stay idempotent — two operators acknowledging concurrently must not error.

## MISSING — auth (spec §5)

| Method | Path                       | Notes                                                             |
| ------ | -------------------------- | ----------------------------------------------------------------- |
| POST   | `/admin/auth/login`        | email + password → `{ challengeId }`. No self-signup, ever.       |
| POST   | `/admin/auth/2fa`          | `{ challengeId, code }` → `{ token, user, permissions[] }`.       |
| POST   | `/admin/auth/refresh`      | Session lifetime per §5.3.                                        |
| POST   | `/admin/auth/logout`       | Must invalidate server-side; the client also destroys all caches. |
| GET    | `/admin/auth/devices`      | Security & devices screen.                                        |
| DELETE | `/admin/auth/devices/{id}` | Revoke. Step-up required.                                         |
| GET    | `/admin/auth/bootstrap`    | Splash's routing decision (§6.1): `{ minimumVersionMet, biometricEnrolled }`. Unauthenticated-safe. |
| POST   | `/admin/auth/2fa/resend`   | `{ challengeId }` → a fresh challenge. Only the latest code is valid (§6.3). Rate limit 3 / 10 min. |
| POST   | `/admin/auth/unlock`       | `{ password }` → 204. Re-verifies a **locked** session (§5.3 idle timeout) without a new 2FA round. |

Normative client-side shapes: `frontend/apps/admin/src/features/auth/auth.types.ts`.

`permissions[]` is the array `can()` already reads. Sending `null` means "full access", which is the
v1 single-role behaviour.

`/login` and `/2fa` answer their designed failures with data the screens render, so the shapes below
are contractual, not incidental:

| Case | Status | Body |
| --- | --- | --- |
| Wrong credentials | 401 | `{ "error": "INVALID_CREDENTIALS" }` — never says which field, no account enumeration. |
| Locked out | 423 | `{ "error": "ACCOUNT_LOCKED", "retryAfter": 872 }` — seconds; the UI counts it down live. |
| Disabled | 403 | `{ "error": "ACCOUNT_DISABLED" }` — terminal. |
| Wrong code | 400 | `{ "error": "INVALID_OTP", "attemptsRemaining": 2 }` — the count is shown before the lockout, not after. |
| Expired code | 410 | `{ "error": "OTP_EXPIRED" }` |
| Trust slots full | 409 | `{ "error": "DEVICE_LIMIT_REACHED", "devices": [{ id, name, type, lastUsedAt, location }] }` — `type` drives the row glyph. |

There is no signup, no in-app password reset and no account recovery endpoint, and there must never
be one: admin accounts are provisioned by a Super Admin in the web dashboard (spec §10.1).
Biometric and device-passcode verification happen on the device and have **no endpoint at all**.

## MISSING — bookings

| Method | Path                                 | Notes                                                                                                                                                                                                       |
| ------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/ops/bookings`                      | Filters: `state`, `zone`, `service`, `q`, `from`, `to`. No "scheduled" segment — nothing is future-dated (D1).                                                                                              |
| GET    | `/ops/bookings/{id}`                 | Full record + timeline, including **auto-dispatch rounds** ("Round 2 — radius +50% — 6 candidates — top declined"). That diagnostic is the whole reason the timeline exists now that dispatch is automated. |
| POST   | `/ops/bookings/{id}/cancel`          | Step-up + reason. Undo window 10s — the console will call the compensating endpoint if the operator undoes.                                                                                                 |
| POST   | `/ops/bookings/{id}/redispatch`      | Re-runs automation with widened parameters. Not a candidate browser (Booking-Workflow-Decisions §7).                                                                                                        |
| POST   | `/ops/bookings/{id}/manual-complete` | Step-up + reason + evidence ids. The 30-minute lock and evidence gates are **server-enforced**; the console mirrors them for UX only.                                                                       |
| POST   | `/ops/bookings/{id}/refund`          | Step-up + reason + amount (paise). Server enforces the goodwill cap and the rate limit; both have designed failure states.                                                                                  |
| POST   | `/ops/bookings/{id}/assign/undo`     | Compensating action for the 30s assign window. Separately audited — not a rollback of the original entry.                                                                                                   |
| POST   | `/ops/bookings/{id}/cancel/undo`     | Compensating action for the 10s cancel window. Must also reverse the refund it initiated, or say it could not.                                                                                              |

There is deliberately **no reschedule endpoint** — D1 removed rescheduling from the product.

The candidate/assign pair that already exists (`GET /ops/bookings/{id}/candidates`,
`POST /ops/bookings/{id}/assign`) is the **rescue** path only, reached from an escalation
(Booking-Workflow-Decisions D3). The candidate response must also carry the ranking weights and the
dispatch-round history: the console shows what the ranking weighted, because an override is only
safe if the operator can see what they are overriding (spec §6.10).

### Idempotency on these six endpoints is not optional

Every mutation above **must** honour an `Idempotency-Key` request header. The console mints one key
per *intent* — not per network attempt — and only rotates it after a submission has succeeded, so a
retry after a timeout carries the same key and must return the first result rather than acting
again. Without server-side honouring, a flaky connection during a refund is a duplicate refund and a
flaky connection during a manual completion is a second customer notification. The client-side
in-flight guard (`useAppForm`) only protects one browser tab.

Normative client-side shapes: `frontend/apps/admin/src/features/booking-actions/booking-actions.types.ts`.

The high- and critical-risk mutations here also expect:

| Endpoint | Designed failures the UI already renders |
| --- | --- |
| `/cancel` | `409` booking already terminal · refund-override justification is a separate audited field |
| `/manual-complete` | `409 TOO_EARLY` with `availableAt` · `422 EVIDENCE_INSUFFICIENT` naming the missing item |
| `/refund` | `422 EXCEEDS_CAP` with a field error on the amount · `429` rate limited with the reset time · `202` + `isPending` when the gateway does not confirm (never reported as done) |

**Reason codes** for these flows are declared in
`frontend/apps/admin/src/features/booking-actions/booking-actions.constants.ts` because neither
`@sethu/domain` nor the generated client carries a vocabulary yet. When the backend enum lands it
must be mirrored into `@sethu/domain` and the local `as const` deleted.

## MISSING — providers

| Method | Path                                       | Notes                                                                                                                                                                          |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/ops/providers`                           | `?segment=online\|onJob\|all&search=`. Roster rows plus `counts`, `shortfall` (worst zone below threshold, or null), `pendingApplications`, `oldestApplicationDays`, `statusesAsOf`. |
| GET    | `/ops/providers/{id}`                      | Profile, performance metrics with their §6.16 band, documents with expiry, skills, recent jobs, feedback, flags, payout cycle, `version`.                                        |
| GET    | `/ops/providers/{id}/active-jobs`          | Step 3 of the suspend flow. Live bookings with stage, customer, ETA/started, amount, and a suggested reassignment target.                                                        |
| POST   | `/ops/providers/{id}/suspend`              | One payload for all three outcomes, typed by `type` = `force_offline\|suspend\|block`: `{ version, type, durationDays, reasonCode, note, jobResolutions, notifyImmediately }`.    |
| POST   | `/ops/providers/{id}/block`                | Critical risk. May be folded into `/suspend` with `type=block`; the console sends one shape either way.                                                                          |
| POST   | `/ops/providers/{id}/force-offline`        | Medium risk, reason code, 30s undo. Same note.                                                                                                                                  |
| POST   | `/ops/providers/{id}/restore`              | Reverses a suspension or a block; also the undo target inside the 10s window.                                                                                                   |
| GET    | `/ops/applications`                        | `?segment=pending\|awaitingDocs\|decided`. Rows plus `counts` and `oldestDays` for the 48-hour SLA line.                                                                        |
| GET    | `/ops/applications/{id}`                   | Review, with document URLs for the viewer, auto-validation results, and **`approvalBlockers[]`** — the server-enforced approval gate the UI mirrors (§6.18).                     |
| POST   | `/ops/applications/{id}/approve`           | Undo window 30s. `409` when another admin decided first; the body must carry the decision, decider and timestamp so the console can render the already-decided record.           |
| POST   | `/ops/applications/{id}/reject`            | Critical risk. Step-up + `{ reasonCode, note }`, note ≥ 20 characters. No undo — the applicant is notified by SMS immediately.                                                   |
| POST   | `/ops/applications/{id}/request-documents` | Low risk. Selects which documents to ask for; sends SMS + push.                                                                                                                 |

Normative client-side shapes: `frontend/apps/admin/src/features/providers/{providers,suspend,applications}.types.ts`.

## MISSING — live map (spec §6.7)

| Method | Path            | Notes                                                                                                                                                                                                                                                                                                     |
| ------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/ops/live-map` | One snapshot: `{ observedAt, activeJobCount, onlineProviderCount, zones[], providers[], jobs[], clusters[], attention[], zeroSupplyZoneIds[] }`. Normative shape is `features/map/map.types.ts`.                                                                                                          |

Notes the console assumes:

- **Positions are percentages of the service-city bounding box, not lat/lng.** The console renders an
  abstract SVG surface today; when a tile layer lands it will ask for `{ lat, lng }` on the same
  fields. Either way the server projects — the client never geocodes.
- `activeJobCount` / `onlineProviderCount` are **city totals**, not counts of the markers in the
  response. The response ships the requested viewport only (spec §6.7 caps rendering at 200 markers).
- `zeroSupplyZoneIds` lists zones with **nobody online at all**. The console renders a danger banner
  naming the commercial consequence, and expects the same zones' providers to be absent from
  `providers[]` — a banner over a zone still showing free technicians is worse than no banner.
- `clusters[]` is server-side clustering above 50 markers; each carries the zone it collapses.
- Provider positions are throttled to **10s**. The console polls at that rate until `GET /ops/stream`
  exists, at which point provider-location events replace the poll.

## MISSING — alerts, audit, settings

Normative alert shapes: `frontend/apps/admin/src/features/alerts/alerts.types.ts`.

| Method  | Path                            | Notes                                                                                                                  |
| ------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| GET     | `/ops/alerts`                   | Feed with severity (`critical`/`warning`/`informational`), `requiresAcknowledgement`, the acknowledgement (admin id, name, time) and the subject record. |
| GET     | `/ops/alerts/{id}`              | Detail: description, the trigger rule (rule + threshold + actual reading), the related record, related alerts, notes. Unknown or deleted id must be a **404**, which the console renders as NotFoundState — `/alerts/:id` is a push-notification target. |
| POST    | `/ops/alerts/{id}/acknowledge`  | **Idempotent and concurrency-safe.** Two operators acknowledging the same alert simultaneously must NOT error: first writer wins and the second gets `200` with the winning acknowledgement, so the client can show "acknowledged by someone else" rather than a failure (spec §6.20 edge cases). Acknowledgements are also replayed after an offline period, so a repeat of an acknowledgement this admin already won must also succeed. Audited; low risk — no step-up, no reason code, no undo. |
| POST    | `/ops/alerts/read-all`          | Marks the **informational tier only** read. It must never bulk-acknowledge a critical alert — that would defeat the badge-discipline mechanism (spec §3.1, §6.20).                                                                                                                                    |
| POST    | `/ops/alerts/{id}/notes`        | `{ body }` → the created note. The handover record between admins on one alert (spec §6.21).                                                                                                                                                                                                          |
| GET     | `/ops/audit`                    | Append-only. Query: `cursor`, `limit`, `adminId`, `action`, `targetType`, `targetId`, `from`, `to`. Response `{ items, total, nextCursor }` where each item is the §10.4 schema **plus** `compensatesEntryId` and `compensatedByEntryId` (both nullable). `action` is the SCREAMING_SNAKE audit vocabulary, not the dotted registry id. `before`/`after` are `Record<string, string>` of display-ready values. |
| GET     | `/ops/audit/{id}`               | Entry detail, including `before`/`after` and the compensating-entry link. Unknown id must be a **404** — the entry screen is a deep-link target and renders NotFoundState. |
| GET     | `/ops/audit/admins`             | The distinct admins that appear in the log, for the Admin filter: `[{ id, name, email }]`. Derived server-side; the console must not page the whole ledger to build a filter. |
| GET/PUT | `/admin/settings/notifications` | Channels and quiet hours. Normative shape: `frontend/apps/admin/src/features/settings/settings.types.ts`. Only the CONFIGURABLE tier is stored — the four critical channels are not preferences and must not be accepted in a PATCH (spec §6.30). `quietHours.from`/`to` and `digestTime` are `HH:mm` IST wall-clock, not instants. PATCH returns the whole updated object so the console's optimistic update can settle on the server's copy. |
| GET     | `/admin/settings/security`      | Biometric-unlock flag, trusted devices (`{ id, name, kind, lastUsedAt, location, isCurrent }`), `deviceLimit`, active-session count, `passwordChangedAt`, and the recent security events (`signedIn`/`failedSignIn`/`deviceTrusted`/`passwordChanged`). A failed sign-in from an unrecognised device must return `device: null`, not a placeholder string — the console renders "unknown" itself. |
| PATCH   | `/admin/settings/security`      | Biometric unlock only. Disabling it tightens the idle lock to 10 minutes (spec §6.31), which is server-enforced policy, not a client default. |
| GET/PUT | `/admin/profile`                | Profile. Phone is Super-Admin-only, per spec, and must arrive **already masked** — the console never receives a full number (§5.6). Preferences (appearance, haptics, default landing tab) round-trip on the same object. |
| GET     | `/admin/version`                | App / build / environment / OTA bundle, for the support version block (§6.33). |
| POST    | `/admin/diagnostics`            | Uploads logs, device model, OS version and the last 200 network events. Must reject any payload carrying customer PII (§5.6); the consent notice in the UI states exactly this. |
| GET     | `/admin/queued-actions/count`   | Unsynced offline actions, so the sign-out confirm can name how many will be discarded (§6.22). |
| GET     | `/ops/payouts/current`          | The open settlement cycle: totals, cycle-close and next-run timestamps, and the per-provider rows (`jobs`, `grossPaise`, `commissionPaise`, `adjustmentsPaise`, `netPaise`, `status`). Amounts are paise, int64. The totals cover the whole cycle, not the returned page. Desktop-only surface (§1.5) but the mobile "Best on desktop" notice reads the three headline numbers from the same response. |

`DELETE /admin/auth/devices/{id}` (already listed under auth) is the revoke this console calls. It is
`device.revoke` in the action registry: high risk, step-up required, no reason code, no undo. When the
id is the caller's own device the response must also invalidate the calling session, because the
console signs out and destroys every cache immediately afterwards (§5.6).

The audit log must reject writes and deletes at the API level, not merely omit the UI for them.

## MISSING — v1.1 (section G)

`/ops/customers`, `/ops/customers/{id}`, `/ops/customers/{id}/block`, `/ops/tickets`,
`/ops/tickets/{id}`, `/ops/tickets/{id}/reply`, `/ops/analytics/summary`. The console has routes and
navigation for these already; the screens land after A–F is approved.

## Live updates

The dashboard, the map and the alerts feed all poll today. The design assumes near-real-time. When
the backend is ready, an SSE stream (`GET /ops/stream`) carrying booking-state, alert and provider
-location events is preferable to shortening the poll interval — the console already normalises
errors and holds server state in one cache, so the switch is contained.
