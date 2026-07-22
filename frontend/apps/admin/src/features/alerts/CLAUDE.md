# apps/admin/src/features/alerts

Scope: The Alerts Feed (`/alerts`, spec §6.20) and Alert Detail (`/alerts/:alertId`, spec §6.21) — the
consumer surface for the §8 SLA/escalation engine.

Purpose: Make sure nothing important is missed **and that the badge means something**. The badge
counts only unacknowledged **critical** alerts; a badge that is always non-zero is invisible, and an
invisible badge is a missed escalation (spec §3.1).

## Contents

| File                            | Role                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `AlertsFeed.desktop/.mobile`    | The two feed shells (BOX 13–14 / 21–24). Layout only — logic is in the hook.     |
| `AlertDetail.desktop/.mobile`   | The two detail shells (BOX 22–23 / 38–40).                                       |
| `useAlertsFeed`                 | Feed query, severity filter, mark-read. Shared by both shells (anti-drift, §2.1).|
| `useAlertDetail`                | Detail query, not-found detection, add-note.                                     |
| `useAcknowledgeAlert`           | The one write: policy, mutation, badge invalidation, offline queue, replay.      |
| `useAlertTitle`                 | Alert headline = client sentence + server nouns.                                 |
| `useOnlineStatus`               | Connectivity, with a dev-only `?offline=1` override.                             |
| `ackQueue.store`                | Zustand queue of acknowledgements taken offline.                                 |
| `alerts.selectors` / `.filters` | Pure tier splitting, counting and chip building.                                 |
| `alerts.api`                    | The only data boundary. Everything under it is a mock today.                     |
| `alerts.mock` / `alertDetail.*` | Fixtures that mirror the approved designs row for row.                           |

## The rules this folder exists to keep

1. **Two tiers, not one list.** `needs action` is everything with `requiresAcknowledgement`; it gets
   cards, tints, a 3px rail and buttons. `notices` is everything else and gets bare 48px rows. The
   contrast is the design — five harmless alerts must not dilute two urgent ones.
2. **The tier-one section is removed when empty, never shown holding a zero.** A permanent container
   that is usually empty teaches the eye to skip the region that must never be skipped.
3. **All caught up is relief, not absence** — green, via `EmptyState positive` when the feed is
   entirely empty, and a green `Banner` strip when only the needs-action tier is clear.
4. **Acknowledging ≠ resolving.** Every screen that shows acknowledgement also says so in words
   (`AlertOwnership`).
5. **Severity tones live only in `alerts.constants.ts`**, and every tone ships its word: pills carry
   their label, dots carry an `sr-only` one.
6. **Detail navigates, it never acts.** Assign/cancel/re-dispatch belong to the booking features; this
   feature links to their `ROUTES` and stops.

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

## Mock triggers (dev)

| Trigger                              | Shows                                                        |
| ------------------------------------ | ------------------------------------------------------------ |
| `/alerts`                            | 2 unacknowledged criticals + 1 High + 5 informational (BOX 13/21). |
| Acknowledge on **`AL-8823`**         | Success → acknowledged detail/row (BOX 23 desktop, M39).     |
| Acknowledge on **`AL-8830`**         | **Loses the race to Priya Sharma** → "Acknowledged by …" (M23). |
| `/alerts/AL-8790`                    | Informational detail, no ownership, no Acknowledge (M40).    |
| `/alerts/AL-0000` (any unknown id)   | `NotFoundState` (spec §3.4 rule 3).                          |
| `?offline=1` on `/alerts`            | Offline banner; Acknowledge becomes "Queued" (M24).          |
| `VITE_MOCK_MODE=empty`               | "You're all caught up" empty state (BOX 14/22).              |
| `VITE_MOCK_MODE=error` / `slow`      | Error + retry / skeletons.                                   |

## Dependencies

`components/ui/*`, `components/states/QueryBoundary`, `layouts/{Topbar,MobileAppBar}`,
`lib/{format,http,permissions,toast,forms,cx}`, `queries/useShellCounters` (badge invalidation),
`routes/routes.constants`, `@tanstack/react-query`, zustand, `@sethu/i18n` (`adminAlerts`).

## Boundaries

No sibling-feature imports: the booking and provider destinations are reached through `ROUTES` only.
No BEM class from `styles/components.css` is used here — layout is Tailwind token utilities, looks are
primitives. Server state is TanStack Query; the offline queue is the only zustand store, and it holds
intent, not server data.

## Impacted modules

The Alerts badge in `Sidebar`/`TabBar`/`Topbar` (through `SHELL_QUERY_KEYS.counters`), and every push
notification that deep-links to `/alerts/:alertId`.
