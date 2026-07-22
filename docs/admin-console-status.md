# Admin Console — build status and handover

**Branch:** `feat/admin-console-ui` (off `feat/be-fe-restructure`)
**Last updated:** 2026-07-22

This is the working state of `frontend/apps/admin`. It exists because the console was built in one
long session across several parallel workstreams; this file is what a fresh pair of eyes needs.

---

## What is done

### The console itself — sections A–F of the approved designs

39 routes, nine features, both shells, matching the two design artifacts (desktop 1440×900, mobile
390×844) and `docs/Admin-Mobile-App.md` as amended by `docs/Booking-Workflow-Decisions.md`.

Auth · Live dashboard · Needs-attention · Live map · Bookings list and detail · Assign, cancel,
re-dispatch, manual completion, refund · Provider roster, profile, suspend, applications, review ·
Alerts feed and detail · Audit log · Settings (More, notifications, security, profile, help,
payouts, the desktop-only notices).

Section G (Customers, Tickets, Refunds, Analytics) has routes, navigation and a "coming in v1.1"
panel — matching the artifacts' own staging.

Architecture, conventions and the reasoning behind them: `frontend/apps/admin/CLAUDE.md`, and a
`CLAUDE.md` in every folder under `src/`.

### Gates, all green

`turbo build` · `turbo typecheck` (0 errors) · `eslint` (0 errors, 0 warnings) · `prettier --check`
· `i18n:check` · production build. Zero `any`, zero `@ts-ignore`.

### Performance

First paint went from ~600 KB to **146 KB gzip** (130 KB JS + 16 KB CSS):

- `@sethu/i18n` was bundling all three locales, shipping ~174 KB of Hindi and Telugu to every user
  who reads neither. English stays static (it is the fallback and must exist before first paint);
  `hi`/`te` are now separate ~23 KB chunks loaded on selection. **This also benefits the customer
  and provider apps.**
- Vendor chunks split by lifetime — forms (99 KB) and query (36 KB) are off the login path.
- `Sidebar` and `AppRoutes` no longer eagerly import the settings feature.

### Observability

`src/lib/observability/` — an error reporter and an analytics client behind transport seams. A
vendor is installed once at boot; no call site changes. The reporter **scrubs before transmitting**
(PII, tokens, payment references, long free text).

### Tests

Vitest + Testing Library + jsdom + Playwright, wired into `turbo` so CI runs them.
`pnpm --filter admin test`. Covered so far: `lib/format` (spec §4.7's table), `lib/permissions` (the
§10.3 risk register, including "no irreversible action may offer undo"), `hooks/useStepUp` (both
halves of the 60-second window).

### Bugs found by driving the real app — all fixed

1. The 2FA code input swallowed every second digit (stale-closure focus bounce).
2. A page refresh locked the operator out of every permission-gated route — `@sethu/core`'s
   `hydrate()` restored the token but not the user, so `can()` saw a null identity.
3. `overflow-wrap: anywhere` broke words mid-syllable in tables.
4. CSS grid blowout crushed the dashboard's activity rail at 1280px.
5. `formatAge` rendered `34m 15s` where the design shows `34m`.

---

## In flight right now

| Track                                                  | State         |
| ------------------------------------------------------ | ------------- |
| Go API contract (`backend/internal/httpapi/admin*.go`) | Agent running |
| Playwright E2E suite (`apps/admin/e2e/`)               | Agent running |
| Design-system unit tests                               | Agent running |

---

## Not done — the remaining work, in priority order

1. **Migrate feature types onto the generated client.** Once the Go contract lands and
   `pnpm api:generate` runs, ~200 hand-written `*.types.ts` shapes are replaced by generated ones,
   and ~41 local `as const` enum blocks can be deleted. The full migration map is in the OpenAPI
   agent's report; the reasoning is in `docs/admin-api-contract.md`.
2. **Full verification sweep.** Only 6 of 39 routes have been driven in a browser, and those 6
   produced 5 real bugs. Needs: every route at 390/768/1024/1440, the `VITE_MOCK_MODE=error|empty`
   sweep, keyboard-only passes, both multi-step destructive flows end to end.
3. **List virtualisation** — spec §2.4 requires it above ~30 rows. The audit log will render 500
   DOM rows if an operator keeps loading more. The list components are shaped to be wrapped.
4. **Offline cache** — spec §5.6 wants TanStack Query persistence in IndexedDB with a 12h TTL,
   destroyed on logout. Only the alerts acknowledgement queue is genuinely durable today.
5. **Session expiry and token refresh** — not wired.
6. **Screenshot blocking** — `FLAG_SECURE` on Android, iOS privacy blur (spec §5.6). Needs a
   Capacitor plugin.
7. **Biometric step-up** — `hooks/useStepUp` and `components/ui/StepUpChallenge` are complete but
   collect a passcode; the Capacitor biometric plugin is not installed. Integration point is
   commented in `StepUpChallenge.tsx`.
8. **Real `hi`/`te` translations** — keys are complete in all three locales but the values are
   English placeholders. `pnpm i18n:sync-admin` keeps the key sets aligned.
9. **`pnpm cap:sync`** — the native projects still hold an older web build.
10. **Scaffolding to remove before production**: `src/mocks/counterStore.ts` (a dev crutch so the
    badges move) and the `?shell=mobile` dev override in `hooks/useBreakpoint.ts`.
11. **Debug scratch files** left in `frontend/` by an agent: `_dbg.mjs`, `_discover*.mjs`,
    `_walk.mjs`, `d_actions.txt`, `d_mc*.txt`. Delete them.

---

## Known deviations from the approved designs

Both deliberate, both need a designer's sign-off:

1. **The sidebar's "Appearance" row is omitted.** It links to `#` in the artifact and has no route,
   no screen and no theme system behind it. A nav item that goes nowhere is worse than an absent one.
2. **Manual-completion attestation checkboxes default unchecked.** The artifact draws them
   pre-ticked; spec §6.14 draws them empty. In the product's most serious flow, a pre-ticked
   attestation the operator never made is an integrity problem.

Each feature's `CLAUDE.md` lists its own smaller deviations and the mock trigger (a booking id, an
email, a query param) that reaches every designed state.

---

## Recorded standards exceptions

`frontend/ENGINEERING-STANDARDS.md` Part 15 carries three, all argued there: the component CSS
layer, px token values, and the untranslated `hi`/`te` values.

Five files exceed the size caps — `routes/AppRoutes.tsx` (197) and `routes.constants.ts` (207) are
declarative tables where splitting would hurt readability, and three primitives are 3–8 lines over.

---

## The one architectural landmine

**`backend/api/openapi.yaml` is generated, not authored.** `make openapi` produces it from the huma
handlers, and `ci/backend.yml` fails on drift. Never hand-edit it. An earlier attempt did, which
broke the guard and would have been erased by the next generation; it was reverted, and the
endpoints are being declared in Go instead.
