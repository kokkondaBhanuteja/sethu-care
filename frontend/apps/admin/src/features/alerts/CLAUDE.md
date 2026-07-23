# apps/admin/src/features/alerts

Scope: The Alerts Feed (`/alerts`, spec §6.20) and Alert Detail (`/alerts/:alertId`, spec §6.21) — the
consumer surface for the §8 SLA/escalation engine.

Purpose: Make sure nothing important is missed **and that the badge means something**. The badge
counts only unacknowledged **critical** alerts; a badge that is always non-zero is invisible, and an
invisible badge is a missed escalation (spec §3.1).

## Contents

| File                            | Role                                                                                                                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AlertsFeed.desktop/.mobile`    | The two feed shells (BOX 13–14 / 21–24). Layout only — logic is in the hook. Desktop is in the reference page language: crumb Topbar (`pageRendersHeading`), ui-web `PageHeader`, a labelled `FilterBand`/`FilterField` Card over the severity chips. |
| `AlertDetail.desktop/.mobile`   | The two detail shells (BOX 22–23 / 38–40).                                                                                                                                                                                                            |
| `AlertSeverityChips`            | The mobile severity filter: the shared `filterChipClassName` look at the 44px tap-target floor.                                                                                                                                                       |
| `useAlertsFeed`                 | Feed query, severity filter, mark-read. Shared by both shells (anti-drift, §2.1).                                                                                                                                                                     |
| `alerts.time`                   | `formatAlertTime` — the shared `lib/format` en-IN time helper, casing-fixed to the artifacts' uppercase meridiem ("3:12 PM"). Every alert surface uses it; none calls Intl.                                                                           |
| `useAlertDetail`                | Detail query, not-found detection, add-note.                                                                                                                                                                                                          |
| `useAcknowledgeAlert`           | The one write: policy, mutation, badge invalidation, offline queue, replay.                                                                                                                                                                           |
| `useAlertTitle`                 | Alert headline = client sentence + server nouns.                                                                                                                                                                                                      |
| `useOnlineStatus`               | Connectivity, with a dev-only `?offline=1` override.                                                                                                                                                                                                  |
| `ackQueue.store`                | Zustand queue of acknowledgements taken offline.                                                                                                                                                                                                      |
| `alerts.selectors` / `.filters` | Pure tier splitting, counting and chip building.                                                                                                                                                                                                      |
| `alerts.api`                    | The only data boundary. All five `/ops/alerts*` endpoints are REAL through the generated client when `env.useMocks` is false; the mock branch is untouched. Every write sends an `Idempotency-Key`, minted per call (one call = one operator intent — mutations never auto-retry, and acknowledge is additionally idempotent per alert). |
| `alerts.api.map`                | Pure mappers from the generated payloads onto `alerts.types.ts` (unit-tested). Owns the server-code → console-wording joins listed under "Real backend" below.                                                                                        |
| `alerts.mock` / `alertDetail.*` | Fixtures that mirror the approved designs row for row.                                                                                                                                                                                                |

## The rules this folder exists to keep

1. **Two tiers, not one list — drawn as two separated Cards.** `needs action` is everything with
   `requiresAcknowledgement`; it is a danger-edged Card with an icon header (soft red TriangleAlert
   chip + the badge) holding the tinted action cards and acknowledge buttons. `notices` is
   everything else: a plain Card with a muted "Informational" header over bare 48px rows, removed
   entirely when it has no rows. The contrast is the design — five harmless alerts must not dilute
   two urgent ones.
2. **The tier-one section is removed when empty, never shown holding a zero.** A permanent container
   that is usually empty teaches the eye to skip the region that must never be skipped.
3. **All caught up is relief, not absence** — green, via `EmptyState positive` when the feed is
   entirely empty, and a green `Banner` strip when only the needs-action tier is clear.
4. **Acknowledging ≠ resolving.** Every screen that shows acknowledgement also says so in words
   (`AlertOwnership`). On the action card, acknowledging swaps only the Acknowledge slot for an
   inline "Acknowledged by …" line — the tint stays, the text keeps ≥70% opacity, and **Open stays
   live**, because opening the record is exactly what acknowledging commits the operator to. No
   overlay, ever.
5. **Severity tones live only in `alerts.constants.ts`**, and every tone ships its word: pills carry
   their label, dots carry an `sr-only` one. Selection never repaints: the shared Card's `selected`
   is a `ring-ring` ring over whatever fill the card already has, so a selected critical card stays
   red.
6. **"Mark read" lives on the informational tier's own header** (`AlertNoticeList`), never in the
   page chrome — parked in a topbar it promises page-wide reach it does not have. It disappears
   with the tier, which is correct.
7. **Detail navigates, it never acts.** Assign/cancel/re-dispatch belong to the booking features; this
   feature links to their `ROUTES` and stops. Everything that navigates says so: informational rows
   and the preview title carry the app's link language — hover treatment plus the trailing chevron.
8. **The trigger audit is an info-tinted Card.** `AlertTriggerCard` draws "why this alert fired" as a
   blue-tinted Card (solid Gauge chip header) whose rule / threshold / actual sit in a definition
   list; the actual reading inks red only when a line was actually crossed.

## Business logic

- Acknowledge is `ADMIN_ACTIONS.acknowledgeAlert` — low risk, no step-up, no reason, no undo, audited.
  All of that is read from the registry, never restated.
- `useAcknowledgeAlert` invalidates **both** the alerts cache and `SHELL_QUERY_KEYS.counters`, so the
  Alerts badge drops the moment an alert is owned.
- Losing an acknowledgement race is **not** a failure. The endpoint is idempotent; the loser gets
  `wonRace: false` plus the winner's name, the row shows "Acknowledged by …", and no error is raised.

## Offline queue — what is real and what is not

Real: connectivity detection, the "Queued" control replacing Acknowledge, the counted offline banner,
de-duplication of repeated taps, and automatic replay (sequential, failure-tolerant) on reconnect.

**Not real: durability.** The queue is in memory (`ackQueue.store.ts`). It survives navigation between
screens but **not a page reload or an app kill** — a queued acknowledgement is lost in that case, and
the alert simply stays unacknowledged. Persisting it needs a storage backend, and `@sethu/core` does
not export `savePreference`/`loadPreference` today (they exist in `session/storage.ts` but are not in
the package's `index.ts`). One export there plus a hydrate-on-boot call in this store makes it
genuinely durable; nothing else in this folder would change.

## Real backend (`VITE_USE_MOCKS=false`) — the contract as it actually behaves

- **The feed is one whole-feed fetch.** `GET /ops/alerts` with `acknowledged` omitted returns every
  tier and every acknowledgement state (only `acknowledged=true` narrows); the two-tier split and
  all counting stay client-side in `alerts.selectors`/`.filters`, exactly as with the mock.
- **The `{id}` convention:** an alert's own uuid works, and a BOOKING uuid resolves to that
  subject's newest alert — the dashboard's attention queue deep-links with booking-scoped ids.
- **The server sends data and codes, the console words them** (`alerts.api.map.ts`):
  `summaryParams` (`reference`/`service`/`zone`, "" dropped) is joined into `summary`;
  `trigger.rule` codes (`booking.escalated`) and dispatch-history event codes
  (`ESCALATE: SEARCHING → ESCALATED`) get console labels with an honest raw passthrough for
  unknown codes; `relatedRecord.bookingState`/`providerStatus` become the pill's word + tone.
  Only `description` arrives as a server-composed sentence.
- **Acknowledge replay is a receipt, not an error:** a late acknowledger gets HTTP 200 with
  `wonRace: false` and the winner's acknowledgement — the same designed state the mock's race
  fixture exercises.
- Only `bookingEscalated` alerts are produced today; the other types in `ALERT_TYPES` are declared
  vocabulary the engine has not started emitting.

## Mock triggers (dev)

| Trigger                            | Shows                                                              |
| ---------------------------------- | ------------------------------------------------------------------ |
| `/alerts`                          | 2 unacknowledged criticals + 1 High + 5 informational (BOX 13/21). |
| Acknowledge on **`AL-8823`**       | Success → acknowledged detail/row (BOX 23 desktop, M39).           |
| Acknowledge on **`AL-8830`**       | **Loses the race to Priya Sharma** → "Acknowledged by …" (M23).    |
| `/alerts/AL-8790`                  | Informational detail, no ownership, no Acknowledge (M40).          |
| `/alerts/AL-0000` (any unknown id) | `NotFoundState` (spec §3.4 rule 3).                                |
| `?offline=1` on `/alerts`          | Offline banner; Acknowledge becomes "Queued" (M24).                |
| `VITE_MOCK_MODE=empty`             | "You're all caught up" empty state (BOX 14/22).                    |
| `VITE_MOCK_MODE=error` / `slow`    | Error + retry / skeletons.                                         |

## Dependencies

`components/ui/*` (incl. `FilterBar`'s exported `filterChipClassName`), `components/states/QueryBoundary`,
`layouts/{Topbar,MobileAppBar}`, `lib/{format,http,permissions,toast,forms,cx}`,
`queries/useShellCounters` (badge invalidation), `routes/routes.constants`,
`@sethu/ui-web` (`PageHeader`, `FilterBand`/`FilterField`, plus the card anatomy noted below),
`@tanstack/react-query`, zustand, `@sethu/i18n` (`adminAlerts`).

## Boundaries

No sibling-feature imports: the booking and provider destinations are reached through `ROUTES` only.
No BEM class from `styles/components.css` is used here — layout is Tailwind token utilities, looks are
primitives (the `components/ui` adapters, plus `@sethu/ui-web` directly for the global card anatomy:
`CardHeader`/`CardContent`, `IconChip`). Server state is TanStack Query; the offline queue is the only zustand store, and it holds
intent, not server data.

## Impacted modules

The Alerts badge in `Sidebar`/`TabBar`/`Topbar` (through `SHELL_QUERY_KEYS.counters`), and every push
notification that deep-links to `/alerts/:alertId`.
