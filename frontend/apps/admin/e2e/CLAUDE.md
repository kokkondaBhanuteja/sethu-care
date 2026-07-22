# apps/admin/e2e

Scope: The Playwright end-to-end suite for the admin console — the only tests that drive the real
built app in a real browser.

Purpose: Prove the things a unit test cannot: that a deep link survives a sign-in, that a
destructive flow cannot be completed without its reason code and step-up, that an irreversible one
offers no undo, that every route in the table renders, and that no width scrolls sideways.

Rules: `.claude/skills/playwright-e2e/SKILL.md` — Page Object Model, `getByRole`/`getByLabel`/
`getByText` only (never CSS selectors or test ids), web-first assertions, no manual waits, one
behaviour per test, feature-named spec folders. **Its `global-setup` rule is deliberately deviated
from — see below.**

## The mocked-login deviation

The skill describes a dev-OTP login against the local Go API. **The admin console has no backend.**
Only six `/ops/*` endpoints exist (`docs/admin-api-contract.md` is the backend's work list) and the
app runs on `VITE_USE_MOCKS=true`, which is the default. Pointing this suite at a Go backend would
make every screen fail with a 501.

So:

- `webServer` previews the **built** app with mocks on. No `VITE_API_URL`, no backend process.
- `global-setup.ts` performs the **mocked** login documented in `src/features/auth/CLAUDE.md`: any
  plausible email, any password of 8+ characters, then any six digits. It saves `storageState`,
  which every project except `auth` reuses. No spec logs in except the auth specs.
- `VITE_*` is inlined by Vite at **build** time, so `VITE_MOCK_MODE` cannot be flipped on a running
  `vite preview`. Each mock mode is its own bundle in `dist-e2e/<mode>` on its own port:
  4300 `normal`, 4301 `error`, 4302 `empty`. Because localStorage is origin-scoped, global setup
  writes the one session out once per origin.

The full argument is at the top of `playwright.config.ts`. Do not "fix" it back to a backend that
does not exist.

## Layout

| Folder / file        | What lives there                                                                      |
| -------------------- | ------------------------------------------------------------------------------------- |
| `global-setup.ts`    | The mocked sign-in, once. Writes `.auth/storageState*.json` (gitignored).              |
| `fixtures.ts`        | Page objects injected as test parameters. Re-exports `expect`.                         |
| `pages/`             | One Page Object per screen or flow. `ActionFlowPage` is the destructive-flow base.     |
| `support/env.ts`     | Ports, origins, storage-state paths, the 768px shell split, the error-state timeout.   |
| `support/mockTriggers.ts` | **The fixtures.** Every booking id, email and code, copied from the feature that documents it. |
| `support/routeExpectations.ts` | Route pattern → URL + heading. `shell/routes.spec.ts` drives off this.        |
| `support/navigation.ts` | Sidebar and tab destinations, resolved from `navigation.constants.ts` + the en locale. |
| `support/controls.ts` | `chooseOption` — keyboard selection for the `sr-only` native radios.                  |
| `auth/`              | Sign-in, deep-link resume, the designed failures, the code input, no-self-signup.      |
| `shell/`             | Every route, the sidebar, the desktop-only surface guard, not-found.                   |
| `bookings/` `providers/` | The critical flows: cancel, manual completion, refund, suspend, application reject. |
| `states/`            | `VITE_MOCK_MODE=error` and `=empty` on the main list screens.                           |
| `responsive/`        | The same specs at 390 / 768 / 1024 / 1440.                                              |
| `a11y/`              | Keyboard-only paths through the modals and drawers.                                     |

## Two conventions worth knowing before you write a spec

1. **Mock triggers are the fixtures.** There is no seeded database. A booking id, an email or a
   six-digit code selects a designed state — `B-8809` is "evidence missing", `B-8787` is "rate
   limited", `locked@setucare.in` is "account locked". They all live in `support/mockTriggers.ts`
   with a pointer to the feature CLAUDE.md that owns them. Never invent one inline.
2. **Radio groups are selected with the keyboard.** `components/ui/form/RadioGroup.tsx` renders a
   real native `<input type="radio">` marked `sr-only` behind a painted span — the right pattern,
   and the reason the group gets arrow-key navigation for free. It also means the input is a 1x1
   clipped box no pointer hit-test can reach. Use `chooseOption(group, label)`, never `check()` and
   never `force: true`.

## Projects

| Project                          | What it runs                                | Session         |
| -------------------------------- | ------------------------------------------- | --------------- |
| `auth`                           | `auth/**` at 1440x900                       | **none**        |
| `console`                        | `shell/`, `bookings/`, `providers/`, `a11y/` at 1440x900 | shared |
| `states-error` / `states-empty`  | `states/**` against :4301 / :4302           | shared          |
| `responsive-{390,768,1024,1440}` | `responsive/**` at each width               | shared          |

768 is a project on purpose: it is the boundary itself. `useIsDesktop()` is `(min-width: 768px)`,
so at exactly 768 the **desktop** shell renders.

## Failing tests are findings

A spec that fails because the app is wrong stays failing, marked `test.fail()` with a comment
naming the defect. It is never weakened to go green. Playwright counts an expected failure as a
pass, so the run is green while the defect is open — the `✘` markers in the output are the list of
open defects, and each one carries its explanation in the spec.

Two are open today:

1. **`bookings/manual-completion.spec.ts` — the whole file.** `/bookings/<any id>/manual-complete`
   throws `RangeError: Invalid time value` on first render and dies in `RouteErrorBoundary`.
   `OtpArrivedInterrupt` formats `context?.otpArrivedAtIso ?? ""` in its component body, which runs
   before any data arrives and whether or not its modal is open. `shell/routes.spec.ts` carries the
   same expectation for that route, via the `defect` field in `support/routeExpectations.ts`.
2. **`providers/suspend-provider.spec.ts` — "step 3 must not be skipped…".**
   `useSuspendProviderFlow.goNext` reads an unresolved active-jobs query as zero active jobs, so a
   Continue pressed before the record loads skips the reassignment step — the step the flow exists
   for. The other step-3 tests reach step 3 through `continueFromStepOne()`, which waits for the
   record first, so they test step 3 rather than re-testing the race.

## Running it

```
pnpm --filter admin build          # from frontend/ — the workspace root
pnpm --filter admin test:e2e
pnpm exec playwright install chromium     # first run only
```

From `apps/admin` directly:

```
pnpm exec playwright test                       # everything
pnpm exec playwright test --project=console     # one project
pnpm exec playwright test auth/ --headed        # watch it happen
pnpm exec playwright show-report
```

The three preview servers are started by `webServer` and reused between local runs; on CI they are
always built fresh. The first run of a session pays for three Vite builds (~25s).

Impacted modules: none — this folder is test-only. It reads `src/routes/routes.constants.ts`,
`src/layouts/navigation.constants.ts` and `src/features/auth/auth.constants.ts` directly so the
suite cannot drift from the app's own tables.
