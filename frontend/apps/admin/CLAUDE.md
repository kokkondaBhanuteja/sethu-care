# apps/admin

Scope: The ops console — one responsive codebase serving the admin web dashboard (>=768px
DesktopShell) and the Capacitor admin mobile app (<768px MobileShell).

Spec: `docs/Admin-Mobile-App.md`, **as amended by `docs/Booking-Workflow-Decisions.md`** — assignment
is automated and admin assign is rescue-only, there is no reschedule anywhere, and the bookings list
has no "Scheduled" segment. Flows: `docs/workflows/admin-workflow.md`. Design: the two approved
artifacts (desktop 1440×900, mobile 390×844).

Purpose: Monitor live ops; rescue escalations; emergency cancel; admin-verified manual completion;
providers and applications; refunds; audit. The admin's job is exceptions, not bookings.

## Layout

| Folder                   | What lives there                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `src/index.css`          | Every design token, in Tailwind `@theme`. The only place a value is written.                         |
| `src/styles/`            | The artifacts' component layer. Consumed only by `components/ui` and `layouts`.                      |
| `src/components/ui/`     | The design-system primitives. One configurable component per type.                                   |
| `src/components/states/` | `QueryBoundary` — the §4.10 states, implemented once.                                                |
| `src/layouts/`           | `AdminShell` picks `DesktopShell` (sidebar) or `MobileShell` (tabs).                                 |
| `src/routes/`            | The §3.2 route table and the auth / permission / surface guards.                                     |
| `src/lib/`               | env, `ApiError`, query client, en-IN formatting, the action registry, forms, toasts.                 |
| `src/hooks/`             | Breakpoint, focus trap, step-up, undo, debounce, connectivity.                                       |
| `src/queries/`           | Cross-feature reads only (the shell's badge counters).                                               |
| `src/features/`          | Nine verticals: auth, dashboard, bookings, booking-actions, providers, alerts, map, audit, settings. |
| `src/pages/`             | Thin route targets — read params, pick the shell variant, compose features.                          |
| `src/mocks/`             | Mock transport and the shared counter store. Never imported by a component.                          |

Each folder has its own `CLAUDE.md` with the rules that apply inside it.

## The rules this app is built on

1. **Two shells, never one squeezed.** `MobileShell` and `DesktopShell` are separate components. A
   screen that differs is `<Screen>.desktop.tsx` / `<Screen>.mobile.tsx` over one `use<Screen>()`
   hook — the anti-drift rule from spec §2.1. Desktop turns queues into tables because an operator
   scans a column to find the worst problem; mobile stacks the same records into cards.
2. **The action registry is the single source of policy.** `lib/permissions/actions.ts` declares
   every mutation's risk, step-up requirement, reason-code requirement and undo window from spec
   §10.3. Nothing restates "10 seconds" or "requires biometric" — screens read `useActionPolicy`,
   `useStepUp` and `useUndoableAction`.
3. **Hiding a button is not the security model.** `can()` gates affordances _and_ runs in the
   mutation path; the backend re-authorises everything. Refund, manual completion and application
   rejection have no undo on purpose — each has an immediate outside-world effect and is corrected
   by a compensating, itself-audited action.
4. **Every data-driven section handles all five states** through `QueryBoundary`, and
   empty-because-filtered is distinct from genuinely empty. `VITE_MOCK_MODE=error|empty|slow` walks
   them without a backend.
5. **No raw values.** No colour, px, route string, or backend vocabulary literal outside its
   constants file. Only `components/ui` and `layouts` may name a class from `styles/components.css`.
6. **Every `.tsx` ≤150 lines**, every other source file ≤200.

## Running it

```
pnpm --filter admin dev          # mocks on by default; see .env.example
pnpm --filter admin build
pnpm cap:sync                    # after any web change that must reach a device
```

`?shell=mobile` / `?shell=desktop` force a shell in development — a desktop browser cannot always be
made narrow enough to review the mobile frame, and Windows enforces a minimum window width.

Each feature's `CLAUDE.md` lists the mock trigger (a booking id, an email, a query param) that
reaches every designed state.

## Backend

Six `/ops/*` endpoints exist. Everything else is mock-backed —
**`docs/admin-api-contract.md` is the backend's work list**, and each feature's `*.types.ts` is the
normative shape. Swapping a mock for a real endpoint is a change inside one `.api.ts` file.

Dependencies: `@sethu/{api-client,core,domain,i18n,tokens}`, react-router, TanStack Query, zustand,
react-hook-form + zod, lucide-react, `@capacitor/*`.

Boundaries: never import another app; features never import sibling features; pages never call the
API client directly.

Impacted modules: the admin web deploy and both admin store apps.
