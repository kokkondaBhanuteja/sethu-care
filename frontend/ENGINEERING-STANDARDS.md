# Frontend Engineering Standards — `frontend/`

> The single source of truth for how we build and change the SETHU-CARE frontend
> workspace. Every feature, page, component, hook, service, and refactor follows these
> rules. They exist so the codebase stays **consistent, scalable, and equally readable to
> humans and AI tools** (Claude, Cursor).

**Applies to:** `frontend/` — a pnpm + Turborepo workspace:

| Surface | Stack |
|---|---|
| `apps/customer` · `apps/provider` · `apps/admin` | Vite 7 + React 19 + React Router 7 + TanStack Query + zustand + **Tailwind CSS 4** + Capacitor 7 (iOS/Android) |
| `apps/landing` | Next.js (static export) + GSAP/ScrollTrigger + Lenis + react-three-fiber — same token/i18n/type rules, different framework (noted per-rule) |
| `packages/` | `@sethu/tokens` (design tokens) · `@sethu/api-client` (**GENERATED** from `backend/api/openapi.yaml`) · `@sethu/i18n` (i18next, en/hi/te) · `@sethu/domain` (framework-free enums/IDs) · `@sethu/core` (session/preferences stores + storage adapter) |

It does **not** cover `backend/`, which has its own conventions (`AGENTS.md`, `.ai/`).

---

## How to read this document

Rules are grouped from broad principles down to day-to-day practice. Two things matter
most and are called out first:

1. **A `CLAUDE.md` in every folder** (Part 2).
2. **Folder-scoped files** — each folder owns its own `.tsx`, `.constants.ts`,
   `.api.ts`, `.types.ts`; anything shared by two or more children moves up to the
   parent — and anything shared by two or more **apps** moves into a `@sethu/*` package
   (Part 3).

## How these standards are enforced

Each rule is either **Automated** (ESLint / TypeScript / Prettier / `pnpm i18n:check` /
CI block the merge) or **Review judgment**. When a rule _can_ be automated, adding that
lint/CI check is part of adopting the rule. Code review spends its time on judgment, not
on catching what a tool should catch. The CI gate today: `turbo build` + `turbo
typecheck` + `eslint` + `prettier --check` + `i18n:check` + the generated-client drift
guard (`.github/workflows/frontend.yml`).

---

## Part 0 — Golden Principles

1. **Reuse before you create.** Search first; duplicate never — check the feature, the
   app, then `packages/` before writing anything new.
2. **Keep files small and single-purpose.**
3. **Separate business logic from UI** (logic → hooks/services, UI → components).
4. **Make UI configurable through props.**
5. **Localize all user-facing text** via `@sethu/i18n` — all three locales, same PR.
6. **Keep types strict** — no `any`, no `unknown` leaking out of a boundary.
7. **Never hardcode a value** — colors, sizes, fonts, URLs, routes, strings, numbers all
   come from tokens/constants/generated types.
8. **Never hand-edit generated code** — `packages/api-client/src/generated` is rebuilt
   from the OpenAPI spec (`pnpm api:generate`); change the backend, regenerate.
9. **Document as you go** — the folder's `CLAUDE.md` is updated in the same PR as the code.
10. **Design for reuse and the next reader.** Names explain the _what_; comments explain
    the _why_. Keep code accessible, performant, testable, and maintainable.

---

## Part 1 — Project Structure

Each Vite app (`customer`, `provider`, `admin`) grows into this canonical layout —
**create only the folders a feature actually needs; never create empty folders.**

```text
apps/<app>/
├── src/
│   ├── main.tsx                # Entry: providers + router + configureApiClient + initI18n
│   ├── App.tsx                 # Root: shell(s) + route table
│   ├── index.css               # Tailwind entry + @theme design-token CSS variables
│   │
│   ├── routes/                 # The ONLY place that maps URL ↔ page/layout + guards
│   ├── layouts/                # Page shells (headers, tab bars, MobileShell/DesktopShell)
│   ├── pages/                  # Route entry screens — thin: read params, compose features
│   │
│   ├── features/               # Product verticals (the real logic + UI). See Part 1.2
│   │   ├── booking/
│   │   ├── catalog/
│   │   └── …
│   │
│   ├── components/             # App-shared UI kit used by 2+ features
│   ├── hooks/                  # App-wide hooks only (no feature-specific hooks here)
│   ├── queries/                # App-shared TanStack Query read hooks (cross-feature)
│   ├── mutations/              # App-shared TanStack Query write hooks (cross-feature)
│   └── lib/                    # App-wide non-React glue (native bridge wiring, env)
├── capacitor.config.ts
├── ios/  android/              # COMMITTED Capacitor projects — update via `cap sync` only
```

There is **no per-app `services/` HTTP layer and no `rsrc/`**: HTTP lives in the
generated `@sethu/api-client` (wrapped by feature `.api.ts` files), and localization
lives in `packages/i18n/locales/{en,hi,te}/`. The landing app follows Next.js layout
conventions (`app/`, `components/`) but obeys every non-structural rule here.

### 1.1 Pages vs Features vs Routes

- **`routes/`** — the only place that knows about URLs. Maps a path (incl. params like
  `/bookings/:id`) to a page and a layout, and applies guards (auth, role,
  `surface: desktopOnly` for admin per the Admin spec §1.5).
- **`pages/`** — the routing target. A page reads route params and **composes** features.
  Pages wire; they do not implement.
- **`features/`** — the business logic and UI for one area. Features know nothing about
  URLs and are the reusable blocks pages assemble.

### 1.2 Feature structure

Dotted-file convention. **Group into a subfolder only once you have several files to
group**; until then files sit at the feature root:

```text
features/booking/
├── BookingStatusCard.tsx       # component(s) — PascalCase
├── useBookingCountdown.ts      # feature hook — camelCase, use* prefix
├── booking.api.ts              # feature API calls (wraps @sethu/api-client)
├── booking.types.ts            # feature-only types (server shapes come from the client)
├── booking.constants.ts        # feature constants (query keys, routes it owns)
└── CLAUDE.md                   # describes the whole feature (mandatory)
```

Grow into subfolders (`components/`, `hooks/`, `queries/`, `mutations/`, `utils/`) only
when the count justifies it — each subfolder then gets **its own `CLAUDE.md`**.
Feature-scoped styles are Tailwind classes in the `.tsx`; a feature `.css` file exists
only for genuinely un-utility-able CSS (keyframes, complex selectors) and stays tokenized.

### 1.3 Import boundaries (enforced by review; lint where possible)

1. **Apps never import other apps.** Code needed by 2+ apps lives in a `@sethu/*` package.
2. **Pages** import layouts, features, hooks — **not** the API client directly (go
   through a feature's `.api.ts` or a query/mutation hook).
3. **Features must not import sibling features.** Cross-feature logic is promoted
   (Part 3) after a deliberate review.
4. **Components** never inline visual values — they consume design tokens via Tailwind
   utilities backed by the `@theme` CSS variables (Part 6).
5. **Routes** import pages and layouts only (plus react-router APIs).
6. **Nothing imports `@sethu/api-client/src/generated` internals** beyond the package's
   public exports; nothing edits them.

### 1.4 Where does this go? (quick reference)

| Adding…                                    | Put it in…                                              |
| ------------------------------------------ | ------------------------------------------------------- |
| A screen tied to a URL                     | `pages/` (+ its mapping in `routes/`)                   |
| Logic or UI for one business area          | that feature under `features/`                          |
| A UI component used by 2+ features         | the app's `components/`                                 |
| A UI component used by 2+ **apps**         | a shared package (future `@sethu/ui-web`) — deliberate review first |
| A route definition / guard                 | `routes/`                                               |
| A page shell (header, tab bar, sidebar)    | `layouts/`                                              |
| An HTTP/API call                           | `<feature>.api.ts`, wrapping `@sethu/api-client`        |
| A TanStack Query read / write hook         | feature `queries/`/`mutations/`, or app-level when cross-feature |
| A reusable hook                            | `hooks/` (app) or the feature's folder                  |
| A constant / enum / type                   | the matching `.constants.ts` / `.types.ts`              |
| A backend-mirrored enum / branded ID       | `@sethu/domain` (never redeclared locally)              |
| A design token (color, spacing, size)      | `@sethu/tokens` + the app's `@theme` block (Part 6)     |
| Any user-facing text                       | `packages/i18n/locales/{en,hi,te}/…` (Part 8)           |
| Session/token/preference persistence       | `@sethu/core` (storage adapter — never raw localStorage in app code) |

---

## Part 2 — `CLAUDE.md` in Every Folder (mandatory)

**Every folder under an app's `src/` (and every package root) contains a `CLAUDE.md`.**
It is the contract for humans and AI tools, and it is named `CLAUDE.md` specifically so
Claude Code auto-loads it as nested context when working inside that folder.

> We document at the **folder level only** — no per-component doc file. Because `.tsx`
> files are capped small (Part 7), a folder's `CLAUDE.md` explains everything in it.

A folder's `CLAUDE.md` answers, briefly and normatively:

```md
# <Folder name>

Scope: One sentence — what belongs in this folder (and what does not).
Purpose: Why this folder/feature exists.
Contents: The key files and what each is responsible for.
Business logic: The behaviours implemented here (countdown, list filtering, queue sync…).
Dependencies: What it imports (@sethu/* packages, shared components, feature hooks).
Boundaries: "Do not" rules — e.g. "no sibling-feature imports", "no raw fetch here".
Impacted modules: What breaks downstream if this changes.
```

Rules:

- A folder is **not complete** until its `CLAUDE.md` exists.
- **Keep it in sync — same PR as the code.** An outdated `CLAUDE.md` is worse than none.
- Keep it **short, current, normative.** If code and `CLAUDE.md` disagree, fix one of
  them in that PR.

---

## Part 3 — Folder-Scoped Files & the "Promote Upward" Rule

### 3.1 Each folder owns its own supporting files

| File                  | Holds                                                    |
| --------------------- | -------------------------------------------------------- |
| `*.tsx`               | Components belonging to this folder                      |
| `<name>.constants.ts` | Constants & enums used only in this folder               |
| `<name>.types.ts`     | Types & interfaces used only in this folder              |
| `<name>.api.ts`       | API calls used only in this folder (wrapping the client) |

Do not reach into another folder's scoped files. Needing to is the signal to promote.

### 3.2 Shared-across-children → move to the parent (monorepo-aware)

> If a constant, type, hook, or function is used by **two or more children** of a folder,
> it moves **up to the nearest common parent** — and the ladder continues past the app:

- Used in one feature only → stays in that feature.
- Used by two features of one app → promote to that **app's** shared layer
  (`components/`, `hooks/`, `queries/`, `mutations/`, or a top-level `*.constants.ts`).
- Used by two **apps** → promote to the right `@sethu/*` package (`domain` for
  vocabulary, `core` for session/persistence, `i18n` for text, `tokens` for design;
  a shared UI package is created deliberately, not by accident).

**Default to keeping code local; promote only when a real second consumer appears** —
not preemptively.

---

## Part 4 — Type Safety (strict)

- **No `any`. No `unknown` leaking out of a boundary.** `unknown` is allowed only at a
  trust boundary and must be narrowed immediately. It never appears in a function
  signature, prop, or exported type.
- `tsconfig` extends `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, …).
  Keep it on. (Known recorded exception: app tsconfigs relax
  `exactOptionalPropertyTypes` because the generated fetch client isn't clean against
  DOM's `RequestInit`; packages keep it.)
- **Server shapes come from `@sethu/api-client` — never retyped by hand.** Backend
  enum vocabularies (booking states, roles, payment methods…) come from the generated
  types / `@sethu/domain`, mirrored verbatim. Never compare against raw string literals:

```ts
// Bad — raw literal, silently breaks when the backend vocabulary changes
if (booking.state === "AWAITING_COMPLETION") { … }

// Good — the shared vocabulary
import { BookingState } from "@sethu/domain";
if (booking.state === BookingState.AwaitingCompletion) { … }
```

- For frontend-only fixed value sets, use `as const` objects + derived union types
  (matches the existing packages style; no TS `enum`):

```ts
export const BOOKING_TABS = { active: "active", completed: "completed" } as const;
export type BookingTab = (typeof BOOKING_TABS)[keyof typeof BOOKING_TABS];
```

- **Never hardcode** URLs, API paths, routes, icon names, magic numbers, storage keys,
  or status values — put them in the folder's `*.constants.ts`:

```ts
export const ROUTES = { bookingDetail: (id: string) => `/bookings/${id}` } as const;
export const QUERY_KEYS = { myBookings: ["bookings", "me"] as const };
```

  API *paths* are already owned by the generated client — never rebuild an endpoint
  string in app code.

---

## Part 5 — Naming & Readability

| Item             | Convention                 | Example                             |
| ---------------- | -------------------------- | ----------------------------------- |
| Component files  | PascalCase `.tsx`          | `BookingStatusCard.tsx`             |
| Hook files       | camelCase, `use` prefix    | `useBookingCountdown.ts`            |
| Supporting files | kebab-case + dotted suffix | `booking.api.ts`, `*.types.ts`      |
| Components       | PascalCase                 | `BookingStatusCard`                 |
| Hooks            | camelCase `use*`           | `useBookingCountdown`               |
| Constants        | UPPER_SNAKE_CASE           | `QUERY_KEYS`, `BOOKING_TABS`        |
| Types            | PascalCase                 | `BookingTab`                        |

- **No single-letter identifiers — anywhere.** This repo is stricter than the usual
  "loop indexes excepted": descriptive names for every variable, parameter, and
  callback argument (house rule, shared with the backend).
- Booleans read as questions (`isLoading`, `hasError`, `canCancel`); functions read as
  actions (`fetchMyBookings`, `formatRupees`).
- **Comments explain the _why_, never the _what_.** If code needs a comment to be
  understood, rename or extract first. Reserve comments for business reasons,
  workarounds, non-obvious decisions, or a spec link (e.g. "Admin spec §6.10").

---

## Part 6 — Styling, Design Tokens & Visual Consistency

### 6.1 Tailwind first

Prefer Tailwind utility classes (v4). Write custom CSS only when no utility fits
(keyframes, complex pseudo-selectors) — and then only with token values. Avoid one-off
custom CSS files.

### 6.2 Tokens only — never hardcode a visual value

Colors, spacing, radii, and typography come from the `@theme` CSS variables in each
app's `src/index.css`, which mirror `@sethu/tokens` (generating `@theme` from the tokens
package is a planned follow-up — until then the two are kept in sync manually, in the
same PR). Consume them through Tailwind's token-backed utilities:

```tsx
// Bad — raw hex / arbitrary px smuggled through Tailwind
<button className="bg-[#1d4ed8] text-[14px] rounded-[8px]">

// Good — token-backed utilities
<button className="bg-primary text-sm rounded-lg">
```

- **No arbitrary-value brackets for anything a token covers.** `w-[37px]` needs the same
  justification a raw hex would (Part 15 exception process). If the design needs a value
  no token covers, **add the token** (in `@theme` + `@sethu/tokens`, one-line comment on
  provenance) — do not inline.
- Never set a raw `font-family`/`font-weight`/`font-size` — the type scale is Inter via
  the theme; weights 400/500/600/700 only.
- **Components of the same type look identical everywhere.** One configurable shared
  component per type (Part 7); a new look is a new variant prop on the shared component,
  never a bespoke restyle.

### 6.3 Units: rem by default; px only where rem genuinely can't work

Tailwind's spacing/font scales are rem-based — using the scale gives you this for free.
The rule matters where you'd write a raw value:

- **Allowed in px:** media-query breakpoints (physical device widths — Tailwind's
  defaults; admin's 768px shell split), third-party APIs that take pixel numbers
  (Capacitor plugins, GSAP/Three numeric props), hairline borders via the border token.
- Everything else is rem **via the scale/tokens** — and when you must use px, leave a
  one-line comment saying why, so nobody "fixes" it.

### 6.4 Native chrome (Capacitor apps)

Safe areas are handled once, in the shell (viewport-fit=cover + `env(safe-area-inset-*)`
in `index.css`) — never per-screen. After ANY web change that should reach a device, run
`pnpm cap:sync`; stale native UI almost always means a missing sync.

---

## Part 7 — Components & Reuse

- **One responsibility per component.** When a component starts doing more than one
  thing, split it: child components in the same folder, logic into hooks,
  constants/types into their scoped files.
- **File size: every `.tsx` ≤ 150 lines; every other source file (hooks, utils,
  `.api.ts`) ≤ 200 lines.** Treat ~100–120 as the signal to look closer. When a file
  outgrows its cap: extract utilities, split components, move logic to hooks — never
  split _only_ to hit a number.
- **Reuse before creating.** Before adding a component/hook/util, check the feature, the
  app's `components/`, and the packages. Build configurable, reusable versions of common
  UI (buttons, inputs, lists, modals, sheets, empty/error/loading views); control
  behaviour through props.
- **Lists:** semantic HTML; stable unique `key` (never the array index when items can
  reorder). Virtualise lists that can exceed ~30 rows (admin queues especially — Admin
  spec §2.4).

---

## Part 8 — Localization (`@sethu/i18n`)

Localization is built in from the start — the pipeline already exists.

- **Never hardcode user-facing text.** Labels, placeholders, buttons, table headers,
  toasts, empty/error states — everything goes through `useTranslation()` /
  type-safe keys from `@sethu/i18n`.
- Keys live in `packages/i18n/locales/{en,hi,te}/` (namespace JSON per feature area),
  registered in `resources.ts`/`config.ts`. **All three locales carry every key** —
  `pnpm i18n:check` fails CI otherwise, and the check runs on every PR.
- New screen/component with text ⇒ its keys land in the **same PR**, in all locales.
- A wrong `t()` key is a compile error (typed resources) — keep it that way; never
  cast around it.
- Format money/dates through shared helpers (`en-IN`: ₹ lakh grouping, DD/MM/YYYY, IST) —
  never ad-hoc `toLocaleString` calls scattered per screen.

---

## Part 9 — Data & API Layer

- **Server data lives in TanStack Query**, never in component state or zustand. zustand
  is for UI/client state only (session status, shell state, connectivity).
- Reads in `queries/`, writes in `mutations/` (feature-level first; app-level when
  cross-feature). Query-key constants, typed responses; never hardcode inside a query.
- **The HTTP layer is the generated client.** `configureApiClient({ baseUrl, getToken })`
  is called once, in `main.tsx`. Feature `.api.ts` files wrap generated SDK calls;
  **queries/mutations call `.api.ts`, never raw `fetch`** and never build URLs.
- **Every data-loading screen handles four states** with shared components:
  loading / error / empty / data. Distinguish "empty because filtered" from "truly
  empty" (Admin spec §4.10).
- **Session handling is centralized:** token persistence via `@sethu/core`'s storage
  adapter; on `401`, clear the session and route to login in one place (the client's
  response hook) — not per call.
- Mutations that create money or side effects send an `Idempotency-Key` where the API
  supports it (booking create today; all admin mutations when that API lands).

---

## Part 10 — Forms, Validation & Security

- **Validate on the frontend before calling the API** (phone E.164 `+91…`, OTP length,
  pincode, required fields) with specific messages that match the backend's rules.
  _Frontend validation is UX only — the backend re-validates everything._
- Prefer one generic field handler over many single-purpose ones.
- Never expose secrets in the frontend. Runtime config comes from `VITE_*` env vars
  (only the API base URL and public keys — e.g. the Razorpay public key id; never a
  secret). The JWT is persisted via `@sethu/core`'s adapter (localStorage on web today;
  the Capacitor secure adapter replaces it on native — never raw `localStorage` calls in
  app code).
- Sanitize any rendered untrusted content; no `dangerouslySetInnerHTML` without a
  sanitizer.

---

## Part 11 — Accessibility & Performance

- **Accessibility:** WCAG 2.2 AA baseline — semantic HTML, labels tied to inputs, ARIA
  only where semantics fall short, full keyboard navigation, visible focus, token-pair
  contrast, `prefers-reduced-motion` honoured (GSAP/Lenis animations collapse to fades —
  landing included).
- **Performance:** budgets from the Admin spec §2.4 apply to all Capacitor apps — cold
  start < 2s on mid-range Android, route transitions < 150ms, initial bundle small via
  route-level code splitting, virtualise > 30 rows, animate transform/opacity only.
- **Lifecycle cleanup — clean up everything you mount:** every listener, timer,
  observer, subscription, GSAP tween/ScrollTrigger, and Lenis instance created in an
  effect **must be torn down in that effect's cleanup**. (The landing `Hero` is the
  template: Lenis is destroyed on unmount; GSAP is scoped via `useGSAP`.)
- **React 19 / hooks discipline** (the patterns the compiler-era lint rules exist for):
  no synchronous `setState` inside `useEffect` (restructure the logic, or derive during
  render); never read `ref.current` during render (effects/handlers only);
  `exhaustive-deps` is satisfied by fixing the logic, never by muting the rule.
- **Lint adherence:** run `pnpm lint` before considering a change complete; zero
  errors *and* zero warnings. `eslint-disable` only when genuinely unavoidable, always
  with a one-line justification on the same line — a silent disable fails review.
- **Logging:** `console.log` fine in dev; must not ship to production paths.

---

## Part 12 — Testing

State _what must be tested_ rather than chasing a coverage number (Vitest is the runner
of choice when the first test lands; the rules apply from that moment):

- **Always unit-tested:** every utility function and all validation logic.
- **Always integration-tested:** critical flows — login/OTP, booking create + the
  60-second cancel window, booking status progression, payment handoff.
- **E2E:** Playwright, per app, following `.claude/skills/playwright-e2e/SKILL.md` —
  Page Object Model, `getByRole`-style locators, web-first assertions, dev-OTP auth via
  a shared `storageState`.
- **Tested as needed:** components with real logic or conditional rendering. Trivial
  presentational components don't need a test.

Write the test in the **same PR** as the code. **Never modify existing test files while
changing product code** unless the task is explicitly about those tests — a failing test
is signal, not friction.

---

## Part 13 — Pull Request Checklist

**Automated (CI must pass):**

- [ ] `turbo build` + `turbo typecheck` pass (strict, no `any`/leaked `unknown`)
- [ ] ESLint + Prettier pass
- [ ] `pnpm i18n:check` passes (all locales carry every key)
- [ ] Generated api-client is up to date (drift guard)
- [ ] Tests pass (once the runner lands)

**Review (a human confirms):**

- [ ] Files live in the right folder; shared code promoted to the correct parent/package (Part 3)
- [ ] Each new/changed folder has an up-to-date `CLAUDE.md` (Part 2)
- [ ] Folder-scoped `.constants.ts` / `.types.ts` / `.api.ts` used correctly (Part 3.1)
- [ ] No raw fetch / hand-built URLs — everything through the generated client (Part 9)
- [ ] User-facing text localized in all three locales (Part 8)
- [ ] Loading / error / empty / data states handled (Part 9)
- [ ] Tokens used for all colors, spacing, typography — no arbitrary-value smuggling (Part 6)
- [ ] Names meaningful (no single-letter identifiers); comments explain _why_ (Part 5)
- [ ] No unjustified `eslint-disable`; zero lint warnings (Part 11)
- [ ] No existing test files modified unless the task was about them (Part 12)
- [ ] No sibling-feature or cross-app imports (Part 1.3)
- [ ] Capacitor apps: `cap sync` run if the change must reach native

---

## Part 14 — Rules for AI Assistants (Claude / Cursor)

Before creating anything:

1. **Reuse before creating** — search the feature, the app, then `packages/`.
2. **Follow the folder structure** (Part 1) and the promote-upward ladder (Part 3),
   including its monorepo rung (2+ apps ⇒ `@sethu/*`).
3. **Read and update the folder's `CLAUDE.md`** in the same change (Part 2).
4. **Keep types strict** — no `any`, no leaked `unknown`; server shapes from the
   generated client; backend vocabularies from `@sethu/domain`, never string literals
   (Part 4).
5. **No hardcoded values** — tokens for visuals (no arbitrary-value brackets),
   constants for everything else (Parts 4, 6).
6. **Never touch `packages/api-client/src/generated`** — regenerate instead.
7. **Localize text** into all three locales in the same change (Part 8); add validation
   (Part 10), accessibility (Part 11), and the four data states (Part 9).
8. Keep `.tsx` files ≤ 150 lines and single-responsibility (Part 7).
9. After web changes that must reach a device, run `pnpm cap:sync` (Part 6.4).

---

## Part 15 — Governance & Exceptions

- **Owner:** the frontend lead owns this document and reviews changes to it.
- **Proposing a change:** open a short PR against this file with the reason.
- **Taking an exception:** a rule can be broken with a good reason recorded in the PR
  and one reviewer's agreement. A recorded, agreed exception is fine; a silent one is
  not. (Current recorded exceptions: `exactOptionalPropertyTypes` relaxed in app
  tsconfigs — Part 4; `@theme` manually mirrors `@sethu/tokens` until generation lands —
  Part 6.2.)
- **Review cadence:** revisit quarterly — remove rules that no longer help, add ones the
  team has learned it needs.

The aim is a standard the team respects because it stays useful — not one it works
around because it has gone stale.
