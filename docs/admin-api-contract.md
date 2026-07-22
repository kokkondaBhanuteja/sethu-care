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

## MISSING — auth (spec §5)

| Method | Path                       | Notes                                                             |
| ------ | -------------------------- | ----------------------------------------------------------------- |
| POST   | `/admin/auth/login`        | email + password → `{ challengeId }`. No self-signup, ever.       |
| POST   | `/admin/auth/2fa`          | `{ challengeId, code }` → `{ token, user, permissions[] }`.       |
| POST   | `/admin/auth/refresh`      | Session lifetime per §5.3.                                        |
| POST   | `/admin/auth/logout`       | Must invalidate server-side; the client also destroys all caches. |
| GET    | `/admin/auth/devices`      | Security & devices screen.                                        |
| DELETE | `/admin/auth/devices/{id}` | Revoke. Step-up required.                                         |

`permissions[]` is the array `can()` already reads. Sending `null` means "full access", which is the
v1 single-role behaviour.

## MISSING — bookings

| Method | Path                                 | Notes                                                                                                                                                                                                       |
| ------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/ops/bookings`                      | Filters: `state`, `zone`, `service`, `q`, `from`, `to`. No "scheduled" segment — nothing is future-dated (D1).                                                                                              |
| GET    | `/ops/bookings/{id}`                 | Full record + timeline, including **auto-dispatch rounds** ("Round 2 — radius +50% — 6 candidates — top declined"). That diagnostic is the whole reason the timeline exists now that dispatch is automated. |
| POST   | `/ops/bookings/{id}/cancel`          | Step-up + reason. Undo window 10s — the console will call the compensating endpoint if the operator undoes.                                                                                                 |
| POST   | `/ops/bookings/{id}/redispatch`      | Re-runs automation with widened parameters. Not a candidate browser (Booking-Workflow-Decisions §7).                                                                                                        |
| POST   | `/ops/bookings/{id}/manual-complete` | Step-up + reason + evidence ids. The 30-minute lock and evidence gates are **server-enforced**; the console mirrors them for UX only.                                                                       |
| POST   | `/ops/bookings/{id}/refund`          | Step-up + reason + amount (paise). Server enforces the goodwill cap and the rate limit; both have designed failure states.                                                                                  |

There is deliberately **no reschedule endpoint** — D1 removed rescheduling from the product.

## MISSING — providers

| Method | Path                             | Notes                                                                    |
| ------ | -------------------------------- | ------------------------------------------------------------------------ |
| GET    | `/ops/providers`                 | Roster with online/busy/offline, zone coverage, ratings.                 |
| GET    | `/ops/providers/{id}`            | Profile, performance, documents with expiry.                             |
| POST   | `/ops/providers/{id}/suspend`    | Step-up + reason. Response must list active jobs that need reassignment. |
| POST   | `/ops/providers/{id}/block`      | Critical risk. Step-up + reason.                                         |
| GET    | `/ops/applications`              | Applications queue.                                                      |
| GET    | `/ops/applications/{id}`         | Review, with document URLs for the viewer.                               |
| POST   | `/ops/applications/{id}/approve` | Undo window 30s.                                                         |
| POST   | `/ops/applications/{id}/reject`  | Critical risk. Step-up + reason.                                         |

## MISSING — alerts, audit, settings

| Method  | Path                            | Notes                                                                                                                  |
| ------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| GET     | `/ops/alerts`                   | Feed with severity and acknowledgement state.                                                                          |
| GET     | `/ops/alerts/{id}`              | Detail.                                                                                                                |
| POST    | `/ops/alerts/{id}/acknowledge`  | Idempotent — two operators acknowledging concurrently must not error; the design shows "acknowledged by someone else". |
| GET     | `/ops/audit`                    | Append-only. Filters by admin, action, target, date. Schema per spec §10.4.                                            |
| GET     | `/ops/audit/{id}`               | Entry detail, including `before`/`after` and the compensating-entry link.                                              |
| GET/PUT | `/admin/settings/notifications` | Channels and quiet hours.                                                                                              |
| GET/PUT | `/admin/profile`                | Profile. Phone is Super-Admin-only, per spec.                                                                          |

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
