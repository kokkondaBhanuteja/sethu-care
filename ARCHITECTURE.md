# SETHU-CARE — System Architecture & Delivery Plan

On-demand home-services platform (appliance repair & maintenance) operated by an appliance
manufacturer. **Backend (P0/P1) is built and green**; the **mobile front end is planned** (this
document). Everything is one Git repository.

- **Backend:** Go 1.26 modular monolith — `net/http` + **huma** (OpenAPI 3.1) · pgx v5 · **sqlc** ·
  **goose** migrations · PostGIS. Correctness-by-construction (typed enums ↔ DB CHECK drift tests,
  append-only ledger, pure state machine, transactional outbox).
- **Contract:** the backend **generates `api/openapi.yaml` from the Go handler types**; the mobile
  client is **code-generated** from that spec — the app cannot call an endpoint or read a field the
  backend doesn't declare.
- **Mobile:** Expo / React Native + TypeScript (New Architecture, Hermes) — two apps (customer,
  provider/technician) + a Next.js admin web, all sharing one design-token system.

---

## Repository map (current)

```
SETHU-CARE/
  Makefile                      # dev/CI commands (make check, make openapi, make reset …)
  docker-compose.yml            # local Postgres/PostGIS on 127.0.0.1:5434
  go.mod  go.sum  sqlc.yaml     # module + sqlc config (*_paise → money.Money, uuid overrides)
  ROADMAP.md  Product.md  PLAN-P0.md  README.md

  api/
    openapi.yaml                # GENERATED from the huma handlers — the API contract (committed)

  cmd/
    api/main.go                 # composition root: wires services, outbox consumers, HTTP router
    genopenapi/main.go          # writes api/openapi.yaml from the huma API (used by `make openapi`)

  internal/                     # one package per bounded context; deps point inward
    config/                     # env → typed Config (JWT, UPI VPA, Cloudinary, credit amount…)
    money/                      # Money value object (paise, int64) — ₹ formatting, no float
    identity/                   # users, roles, technicians; OTP login; rating recompute
    auth/                       # JWT signer + Bearer middleware; AuthedUser in context
    catalog/                    # categories, services, variants, question defs (+ enums)
    address/                    # customer addresses (PostGIS geography)
    order/                      # order status enum (the purchase)
    booking/                    # THE CORE: state machine, transitions, RBAC, service
      state.go statemachine.go permission.go service.go
    verification/               # dual-OTP challenges (hashed/expiring) + work photos
    ledger/                     # append-only money: revenue, cash custody/deposit, credits, UPI
    ops/                        # manual-assignment queue + candidate ranking (PostGIS/skill/shift)
    notifications/              # customer-facing messages via a Sender port (SMS/push seam)
    media/                      # Cloudinary signed-upload signer (SHA1) — no SDK
    reviews/                    # customer reviews → technician rating events
    outbox/                     # transactional outbox dispatcher + worker (at-least-once)
    httpapi/                    # transport: huma operations, auth bridge, error mapping
      huma.go register.go errors.go
      auth.go catalog.go addresses.go ops.go cash.go payments.go photos.go bookings.go
    shared/response/            # tiny JSON helpers
    storage/                    # pgpool, InTx helper, testcontainers harness
      sqlcgen/                  # GENERATED type-safe queries (never hand-edited)

  db/
    migrations/00001..00011_*.sql   # goose migrations (schema + CHECKs + triggers + views)
    queries/*.sql                   # sqlc source queries (one file per context)

  stitch_swiftfix_premium_services/ # DESIGN REFERENCE: "Indigo Velvet" tokens + screen mockups

  mobile/                        # PLANNED (Part B) — pnpm + Turborepo workspace (not yet created)
```

---

# PART A — Backend (built)

## A1. Philosophy

- **Modular monolith, one deployable, one database.** Each `internal/*` package is a bounded
  context. Dependencies point inward; contexts talk through events, not by reaching into each
  other's tables.
- **Module ownership:** exactly one module writes a given aggregate; others react to its events.
  (e.g. `ledger` owns `ledger_entries` + `payments`; `booking` owns `bookings`.)
- **Correctness by construction.** The compiler and the database enforce the rules; tests prove the
  two agree. No rule lives only in a comment.

## A2. Core mechanisms (how it works)

**1. Transactional outbox + worker (`internal/outbox`).** A state change and the event announcing
it are written in the **same transaction** (the booking row + `booking_events` + an `outbox`
row commit together, or none do). A background worker polls the outbox with `FOR UPDATE SKIP
LOCKED`, dispatches to subscribed consumers, and marks handled. Delivery is **at-least-once**, so
**every consumer is idempotent**. This is the backbone that decouples modules: billing, OTP
issuance, notifications, credits, and rating-recompute are all outbox consumers wired in
`cmd/api/main.go`.

**2. Booking state machine (`internal/booking`).** A **pure** function of `(current state, action)
→ next state` over 13 states, guarded by a linter so no transition is defined outside it. Applying
a transition (`Apply`) runs inside one transaction: it re-reads the booking, checks the action is
legal, enforces authorization, runs an optional **guard hook**, writes the new state via an
**optimistic CAS** (`version` column — a concurrent write loses and retries), and appends a
`booking_events` row + an outbox event.

**3. Authorization — per-action RBAC + ownership.** `CanPerform(role, action)` gates by role;
`authorize` checks resource ownership (a customer can only act on their own booking; a technician
on their assigned job). Both run inside `Apply`, because they depend on the booking and its owner —
not just the route.

**4. Dual OTP (`internal/verification`).** Start and completion of a job are gated by a 6-digit OTP
texted to the customer, who reads it to the technician. Codes are **bcrypt-hashed, expiring
(10 min), attempt-capped**. The OTP check is a **guard hook** run *inside* the transition's
transaction — so "code correct" and "state advanced" are atomic. Issuance happens on
`technician.arrived` / `booking.awaiting_completion` outbox events.

**5. Append-only ledger + Money (`internal/ledger`, `internal/money`).** Money is a `Money int64`
value object in **paise** (no floats); `*_paise` DB columns map to it via a sqlc override. The
ledger is **append-only** (a DB trigger forbids UPDATE/DELETE); corrections are offsetting entries.
Entry kinds: `REVENUE`, `CASH_CUSTODY`, `CASH_DEPOSIT`, `CREDIT_ISSUED`, `CREDIT_REDEEMED`, each
constrained to attach at the right level (revenue→order, cash→booking+technician) by a CHECK.

**6. Real payment collection (UPI).** A completed **UPI/ONLINE** booking opens a **PENDING**
`payments` row (a booking-specific UPI QR); **REVENUE is booked only on capture** — the money isn't
the company's until it lands. `CaptureUPIPayment` marks the row CAPTURED and inserts REVENUE
**atomically** (`storage.InTx`), idempotently. Cash instead creates a `CASH_CUSTODY` debt.

**7. Cash settlement & reconciliation.** A technician holding cash owes it; `POST /me/cash/deposit`
writes an offsetting `CASH_DEPOSIT` (guarded: only the holder, only once, only real custody);
`GET /ops/cash-reconciliation` shows each technician's collected/deposited/outstanding with the
oldest uncleared collection (a SQL view).

**8. Notifications via a Sender port (`internal/notifications`).** Consumes booking events and, for
customer-facing ones, records to append-only `notification_log` and delivers through a **`Sender`
interface** (dev `LogSender`; a real MSG91/Firebase impl plugs in at that one seam). The dual-OTP
code is texted straight through the port and **never persisted** (an audit log is not a credential
store).

**9. Work photos via Cloudinary signed upload (`internal/media`, `internal/verification`).** The
technician's app gets a **signature** we mint (SHA1, no SDK) and uploads the file **directly to
Cloudinary** — bytes never touch our server. On record we **verify the returned signature** and
that the URL is ours and names the signed `public_id`, so a technician can't inject an arbitrary
URL. Only the assigned technician may add BEFORE/AFTER photos.

**10. Manual-assignment ops (`internal/ops`).** An admin queue of unassigned bookings and a
**candidate ranking** query filtering by city, skill, online status, leave, capacity, **and shift
hours**, ordered by distance (PostGIS), acceptance rate, and rating.

**11. The API contract — huma → OpenAPI (`internal/httpapi`).** Every endpoint is a **typed huma
operation** (input/output structs); the **OpenAPI 3.1 spec is generated from those types** and
served/committed as `api/openapi.yaml`. `httpapi.RegisterAll` is the single operation list shared by
the server, the tests, and `cmd/genopenapi` — so served, tested, and documented routes are provably
identical. Auth is a huma middleware bridging the JWT signer (bearer scheme + per-operation role
metadata); domain errors map to HTTP via one `classify()`.

**12. Enum drift tests (`internal/schema`, via `make check`).** A test reads the DB CHECK
constraints from `pg_constraint` and asserts they match the Go enum constants (roles, order status,
ledger kinds/methods, payment status, OTP purpose, work-photo kind). Go and the database **cannot
silently diverge**. The same idea now extends to the client: `make openapi-check` fails CI if
`api/openapi.yaml` drifts from the handlers.

## A3. Data model (migrations)

`00001` extensions (uuid, PostGIS) · `00002` platform (users/roles) · `00003` identity ·
`00004` catalog · `00005` addresses & products · `00006` orders & bookings (`version`,
`booking_events`) · `00007` verification (otp_challenges, work_photos) · `00008` ledger
(append-only trigger, attach CHECKs, `technician_cash_position` view) · `00009` outbox & reviews ·
`00010` notifications · `00011` payments (PENDING→CAPTURED).

## A4. API surface (26 operations)

Auth model: public `POST /auth/otp`, `/auth/verify` (phone+OTP → JWT). All others require a Bearer
token; role/ownership enforced per operation. Groups: **Auth · Catalog** (public browse + admin
writes) **· Addresses · Bookings** (create, get, transitions, `/me/bookings`, `/me/jobs`, review)
**· Ops** (queue, candidates, assign) **· Cash** (deposit, reconciliation) **· Payments** (get QR,
capture) **· Photos** (sign, record, list).

## A5. Build & dev

`make check` (lint + openapi drift + tests under `-race`) · `make openapi` (regenerate the spec) ·
`make generate` (sqlc) · `make reset` (rebuild DB) · Postgres on `127.0.0.1:5434`. Tests use
**testcontainers** against real PostGIS.

---

# PART B — Mobile front end (plan)

## B0. Locked decisions
- **Framework:** Expo / React Native + TypeScript (SDK 55, New Architecture, Hermes). Two RN apps
  (customer, provider) + a Next.js admin web. Chosen over Flutter/native for EAS **OTA updates**,
  Expo config plugins, and code sharing across apps.
- **Type sync:** **huma → OpenAPI → Hey API** codegen (drift-proof client). *(Backend half done.)*
- **Repo:** `mobile/` beside the backend; **pnpm + Turborepo**.
- **Styling:** **NativeWind v4** + a three-layer **design-token** system; variants via
  `tailwind-variants`.
- **Design bar:** premium consumer feel (Uber/Rapido/Zomato/Blinkit) + **Apple's latest** language
  (Liquid Glass, Dynamic Island/Live Activities, animated bottom nav). The Stitch **"Indigo
  Velvet"** mockups are a **reference for palette/vibe only**, not a literal layout.
- **i18n:** `expo-localization` + `i18next` + `react-i18next` — **en/hi/te**, type-safe keys, a
  shadow-mirror locales tree.

## B1. Principles (decided up front, so no rework)
- **Structure:** Expo Router v7 (routes are thin shells) · **feature-based modules** (each owns
  `components/hooks/api/types`, exposes a barrel) · shared code in `packages/*` · path aliases.
- **Types:** discriminated unions (mirror backend enums) · branded IDs · generated API types are
  the source of truth · strict tsconfig · widen additively (never repurpose a field).
- **State:** **TanStack Query** owns server state (caching, polling, optimistic updates) ·
  **Zustand** for UI state · Context only for theme/session.
- **Speed (feel as fast as the backend):** **optimistic updates + rollback** on every booking
  action · prefetch on intent · `staleTime`/`gcTime` tuned · **FlashList v2** · **expo-image**
  (blurhash + memory-disk) · Reanimated worklets · request cancellation · Hermes + async routes.
- **Apple durability:** native nav + safe areas + keyboard handling + graceful offline/permission-
  denied · **demo-account/bypass-OTP** for review · **in-app account deletion** · UPI/external
  payment is allowed (no IAP) · Sign in with Apple not required (own OTP) · in-context permission
  strings.
- **i18n:** type-safe `t()` (wrong key = compile error) · shadow-mirror namespaces (lazy-loaded) ·
  `Intl` for ₹/dates · RTL-ready (logical properties) · `i18next-cli status --ci` drift gate.
- **Design system:** three token layers (primitive → semantic (light/dark) → component) in a
  **framework-agnostic `packages/tokens`** shared by all three apps; Stitch `tailwind.config` lifted
  into a NativeWind preset. Variant-driven, `forwardRef`, compound components, headless generic
  tables. **Glass only on the nav layer** (HIG). A11y baked in.
- **Motion & platform-native:** **Reanimated 4** base · **`Link.AppleZoom`** hero transitions ·
  **custom Reanimated AnimatedTabBar** (spring zoom + haptics) over glass · **Rive** for the moving
  rider marker + stateful icons, **Lottie** for one-shots · **Dynamic Island/Live Activities**
  (`expo-live-activity` + Swift target; Android ongoing notification) · **`react-native-maps`** with
  an animated marker · **SVGR** custom typed icon pipeline (Lucide/Phosphor base + branded/service
  icons) · Icon Composer for the iOS-26 app icon. *All need EAS builds (not Expo Go).*
- **Naming:** PascalCase components (dot-members for compounds) · semantic camelCase props ·
  dot-namespaced tokens · kebab-case route files · TS enums mirror backend strings verbatim.

## B2. Planned folder structure

```
mobile/
  apps/
    customer/                     # Expo RN — customer
      app.config.ts  targets/     #   config plugins · iOS Live Activity (Swift/WidgetKit)
      src/app/                    #   Expo Router — routes only; _layout.tsx = provider stack
         (auth)/ (tabs)/ +not-found.tsx
      src/features/               #   auth catalog booking address history payment reviews
      src/lib/  src/store/
    provider/                     # Expo RN — service provider (technician); designs TBD
    admin/                        # Next.js web — admin dashboard (shadcn/ui); shares tokens
  packages/
    tokens/                       # FRAMEWORK-AGNOSTIC Indigo Velvet tokens + tailwind preset
    ui/                           # RN design system (NativeWind): components/ glass/ motion/
    icons/                        # SVGR: svg → typed *.tsx + IconName union (+ Rive)
    api-client/                   # GENERATED typed client + TanStack hooks (never hand-edited)
    domain/                       # framework-free enums, branded IDs, state→actions, money fmt
    i18n/                         # i18next init + type augmentation + locales/<en|hi|te>/…
    core/                         # auth/secure-store, API client + JWT, Query defaults, push
    config/                       # shared eslint/tsconfig/metro/nativewind presets
    utils/                        # pure helpers
  pnpm-workspace.yaml  turbo.json  package.json
```

## B3. Component inventory
- **Primitives:** Button, IconButton, Text, Heading, Input/TextField, TextArea, Select/Dropdown,
  Checkbox, Radio/RadioGroup, Switch, Card, Badge, StatusPill, Avatar, Divider, Icon, Chip.
- **Feedback/overlay:** Toast, Snackbar, Skeleton, Spinner, ProgressBar, EmptyState, ErrorState,
  Modal, BottomSheet (@gorhom v5), ConfirmDialog, Tooltip.
- **Data:** DataList/Table (headless, generic), ListItem, KeyValueRow, Rating, Timeline/Stepper,
  PriceTag.
- **Forms:** Field, FormError, OTPInput, PhoneInput (+91), DatePicker, TimeSlotPicker,
  QuantityInput, SearchInput, CurrencyInput (₹).
- **Layout:** Screen/SafeAreaScreen, VStack/HStack, Spacer, Grid, KeyboardAvoider, ScrollScreen,
  Section.
- **Navigation:** AnimatedTabBar, Header/AppBar, BackButton, SegmentedControl, Fab.
- **Glass/motion:** GlassSurface, AnimatedTabBar, hero-transition helper.
- **Domain composites:** ServiceCard, BookingCard, TechnicianCard, AddressCard, PaymentMethodRow,
  RatingSheet, MapPreview.

---

# PART C — How backend & front end connect

1. **Contract pipeline.** huma types → `make openapi` → `api/openapi.yaml` → Hey API → typed TS
   client + TanStack hooks in `packages/api-client`. CI regenerates both ends and **fails on drift**
   (`make openapi-check` on the Go side, a `git diff` on the generated client) — the same guarantee
   the backend gives between Go enums and DB CHECKs, now extended to the app.
2. **Auth.** `POST /auth/verify` returns a JWT; the app stores it in `expo-secure-store` and the API
   client attaches it as a Bearer header via middleware. Backend enforces role/ownership per
   operation.
3. **Live status.** Booking transitions emit outbox events. The app reflects status via TanStack
   Query polling (+ optimistic updates for instant feel) and, in Phase 3, a **Live Activity /
   Dynamic Island** driven by those same events (ActivityKit push tokens fed from the backend).
4. **Money & enums.** `*_paise` stays typed as Money end-to-end; TS domain enums mirror the backend
   string constants verbatim, so `'PENDING' | 'CAPTURED'` etc. can't drift.

---

# Delivery status & roadmap

- **Phase 0 — Contract & toolchain — DONE** (commit `a0f3fab`): backend migrated to huma;
  `api/openapi.yaml` generated (26 ops); CI drift guard wired; `make check` green.
- **Phase 1 — Monorepo, design system, motion, i18n — NEXT** (the scaffold): pnpm/Turborepo; EAS
  dev client; generate `api-client`; `tokens` (Indigo Velvet) + NativeWind preset; `icons` (SVGR);
  `ui` + glass + AnimatedTabBar (Reanimated 4); `i18n` (en/hi/te, type-safe, drift CI); two RN app
  shells + admin web shell booting on shared tokens in light/dark and all locales.
- **Phase 2 — Auth spine:** phone+OTP, secure-store JWT, demo/bypass-OTP for review, Delete Account.
- **Phase 3 — Customer booking slice:** catalog → optimistic book → `Link.AppleZoom` detail → live
  status (Live Activity/Dynamic Island) → history → rate.
- **Phase 4 — Technician slice:** online/offline, jobs, OTP, work photos (Cloudinary), UPI QR, cash,
  `react-native-maps` tracking with the animated Rive rider marker.

**Verification (each phase):** contract drift fails CI · `pnpm turbo typecheck` (no `any` in
domain) · booking action reflects in UI **before** the network resolves (optimistic) · Apple
pre-check (iPhone SE→Pro Max→iPad, airplane-mode, permission-denied, safe areas, Delete Account,
demo login) · design fidelity in light/dark (WCAG AA) · token change shifts all three apps · wrong
`t()` key / icon name = compile error · EAS dev build runs Liquid Glass on iOS 26 with the blur
fallback elsewhere · 60fps in release mode.
