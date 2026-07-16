# AGENTS.md — SETHU-CARE

Guidance for AI agents (and new contributors) working in this repo. Read this before touching code.
For the deep design rationale, see [`ARCHITECTURE.md`](./ARCHITECTURE.md); this file is the operational
map: how to build, the rules you must not break, what exists, and what is still pending.

SETHU-CARE is an on-demand home-services platform (appliance repair & maintenance) run by an
appliance manufacturer. One Git repo holds a **Go backend** (built, green) and an **Expo/React
Native + Next.js mobile monorepo** (in progress).

---

## 1. Repository layout

```
SETHU-CARE/
  Makefile  docker-compose.yml  go.mod  sqlc.yaml   # backend toolchain
  api/openapi.yaml                                   # GENERATED contract (committed)
  cmd/{api,genopenapi}/                              # composition root + spec generator
  internal/                                          # one package per bounded context
    config money identity auth catalog address order booking verification
    ledger ops notifications media reviews outbox httpapi shared storage schema
  db/{migrations,queries}/                           # goose migrations + sqlc source queries
  mobile/                                            # pnpm + Turborepo workspace
    apps/{customer,provider,admin}/                  # 2 Expo RN apps + 1 Next.js web
    packages/{tokens,ui,icons,api-client,domain,i18n,core,config,utils}/
  ci/                                                # workflow sources + repo ruleset
```

The Go module is the repo root. `mobile/go.mod` is a **deliberate stub** (`module
sethu-care-mobile-ignore`) that walls `mobile/` off from Go's `./...` so `golangci-lint`/`go test`
never descend into vendored `node_modules`. **Do not delete it.**

---

## 2. How to build & run

### Backend (Go 1.26)
Run **`make check`** before every commit — it is exactly what CI runs (`lint` + `openapi-check` +
`test -race`). Other targets:

| Command | Purpose |
|---|---|
| `make up` / `make down` | Start/stop local Postgres+PostGIS (`127.0.0.1:5434`) |
| `make reset` | Rebuild DB from migrations (local only) |
| `make migrate` | Apply pending migrations (goose) |
| `make generate` | Regenerate sqlc Go **after any schema/query change** |
| `make openapi` | Regenerate `api/openapi.yaml` **after any handler change** |
| `make run` | Run the API against local Postgres |
| `make check` | Lint + contract-drift + race tests (pre-commit gate) |

- The API binds **`:8090`** locally (`:8080` is taken by another local project). Health is **`GET /health`**.
- Tests use **testcontainers** (a real PostGIS per package) — a full `go test -race ./...` takes a
  few minutes and is finite; do not "wait forever" for it.

### Mobile (pnpm + Turborepo, Node via nvm)
From `mobile/`:

| Command | Purpose |
|---|---|
| `pnpm typecheck` | `turbo run typecheck` across all 9 packages |
| `pnpm lint` | ESLint (flat config) |
| `pnpm format` / `pnpm format:check` | Prettier write / verify |
| `pnpm api:generate` | Regenerate the typed client from `api/openapi.yaml` |

Run **all three** (`typecheck`, `lint`, `format:check`) before committing mobile code.

### iOS simulator (native dev-client build)
The apps use native modules (Reanimated, secure-store, glass-effect), so **Expo Go will not work** —
you need a dev-client build. The customer app is prebuilt (`apps/customer/ios/`).

```bash
xcrun simctl boot "iPhone 17 Pro" && open -a Simulator
cd mobile/apps/customer && npx expo run:ios --device "iPhone 17 Pro"
```

- Requires **Xcode 26.x** (iOS 26 SDK, Liquid Glass) — confirmed present as **Xcode 26.6 / iOS 26.5**.
- Only **one** `expo run:ios` may build at a time — two concurrent builds lock the DerivedData DB.
  Kill stragglers (`pkill -f "expo run:ios"; pkill -f xcodebuild`) before retrying.
- The simulator reaches the backend at `127.0.0.1:8090` because the built `Info.plist` sets
  `NSAllowsLocalNetworking: true`. `ios/` is **gitignored** (prebuild output) — never commit it.
- **Demo login (bypasses OTP, no SMS):** phone `+919000000000`, code `000000`.

---

## 3. Rules you must not break

These are enforced by the compiler, the database, or a linter — and by review. Violating them fails CI.

**General**
- **No single-letter variable names.** Descriptive names for every variable, parameter, and receiver.
- Match the surrounding code's style, naming, and comment density. Comments state constraints, not narration.

**Backend**
- **Money is `money.Money` (int64 paise). Never use floats for money.** `*_paise` columns map to it via sqlc.
- **The booking state machine is pure.** `(state, action) → next` lives only in
  `internal/booking/statemachine.go`; a depguard rule blocks transitions defined elsewhere.
- **Dependencies point inward.** Depguard rules `cores-must-not-import-consumers` (order/identity/
  auth/catalog/address/booking must not import ledger/notifications/verification/ops/reviews/media)
  and `money-is-a-pure-leaf` are enforced — don't add imports that cross them.
- **Every outbox consumer is idempotent** (delivery is at-least-once).
- **The ledger is append-only** (a DB trigger forbids UPDATE/DELETE); corrections are offsetting entries.
- **Enums cannot drift:** Go enum constants are asserted against DB CHECK constraints in
  `internal/schema` tests. Add both sides together.
- After changing handlers run `make openapi`; after changing schema/queries run `make generate`.
  CI drift-guards both — a stale `api/openapi.yaml` or sqlc output fails the build.

**Mobile**
- **TypeScript is pinned to `^5.9.3` workspace-wide.** Do NOT let `latest` pull TS 7 (the native port).
- **`packages/api-client` is generated — never hand-edit it.** Change the backend, regenerate.
- **i18n keys are type-safe:** a wrong `t()` key is a compile error. New user-facing strings go in
  `packages/i18n/locales/{en,hi,te}/…`, registered in `resources.ts` + `config.ts`. All three locales
  must carry every key.
- **Style via NativeWind classes + design tokens only** (`bg-primary`, `text-on-surface`, …). No raw
  hex in components; raw colour values come from `@sethu/tokens` (`color.*`) only when a native prop needs one.
- Feature-based modules: each `features/<name>/` owns `api/components/…` and exposes a barrel (`index.ts`).
  Routes under `src/app/` are thin shells (Expo Router).
- Strict tsconfig (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) — build request bodies
  without `undefined` keys.

The repo-root **husky pre-commit hook** runs `lint-staged` (gofmt on `*.go`, Prettier on mobile
`*.{ts,tsx}`). Let it run; don't `--no-verify`.

---

## 4. The contract pipeline (backend ↔ mobile)

huma handler types → `make openapi` → `api/openapi.yaml` → `@hey-api/openapi-ts` → typed client +
TanStack Query hooks in `packages/api-client`. The app literally cannot call an endpoint or read a
field the backend doesn't declare. Auth: `POST /auth/verify` returns a JWT; the app stores it in
`expo-secure-store` and `configureApiClient` attaches it as a Bearer header.

**Known wart:** huma is configured `FieldsOptionalByDefault = true`, so **every generated field is
optional** — app code guards with `?.`/`??`. Marking response DTOs required (see §6) is the fix.

---

## 5. What is built

- **Backend — P0/P1 complete, `make check` green.** 30 huma operations across Auth, Catalog,
  Addresses, Bookings, Ops, Cash, Payments, Photos. Outbox worker, pure 13-state booking machine,
  dual-OTP guard, append-only ledger, UPI collection + capture, Cloudinary signed-upload signer,
  manual-assignment ranking, enum-drift + contract-drift CI guards. Added this session:
  `POST /me/availability` (technician online/offline), `GET /me/cash` (technician cash summary),
  `GET /ops/payments` (admin payments queue).
- **Mobile foundation** — pnpm/Turborepo, 3 apps + 9 shared packages, Indigo-Velvet tokens,
  type-safe i18n (en/hi/te), generated api-client, session/secure-store.
- **Customer app (Expo)** — auth (OTP + demo bypass, Delete Account) → catalog (skeleton/empty/error
  states) → service detail → address → optimistic booking → live status → **pay (UPI) + rate** →
  history. Runs natively on iOS 26.
- **Provider app (Expo)** — online/offline toggle, cash-to-deposit summary, job list → job detail
  lifecycle (travel → arrive → start [OTP] → work done → complete [OTP + payment]) → **work photos**
  (camera → Cloudinary → record) → **UPI QR** or cash deposit. Runs natively on iOS 26.
- **Admin console (Next.js)** — admin auth + sidebar shell, Overview (live stats), **Assignments**
  (queue → ranked candidates → assign), **Cash reconciliation**, **Payments** capture, **Services**
  catalog (list + add variant). On the shared tokens; runs at `localhost:3001` (or 3000).
- **Design system** — RN: `Text`, `Button` (gradient), `StatusPill`, `TextField`, `Rating`,
  `Skeleton`, `EmptyState`, `ErrorState`, `Screen`, `GlassSurface`. Web (admin): `Card`, `StatCard`,
  `StatusPill`, `Button`, `PageHeader`, table bits.

---

## 6. Pending functional areas

Grouped by surface. `[ ]` = not started, `[~]` = partial/seam-in-place.

### Backend — productionize the seams
- [ ] **Real notification/OTP delivery.** `notifications.Sender` is `LogSender` only (the log *is* the
      delivery). Plug in MSG91 (SMS) / Firebase (push) at the port. Dual-OTP codes currently only appear
      in backend logs — that's how to read them when testing on device.
- [~] **Cloudinary credentials.** Signer is built; photo endpoints (and the provider photo flow)
      return **503** until `Configured()` is true. Supply cloud name / API key / secret via config.
- [~] **Real UPI capture.** `POST /payments/{reference}/capture` works but is called by an **admin
      standing in for the PSP webhook** (the admin Payments page). Wire the actual provider callback.
- [ ] **Technician live location.** No location-update endpoint; ranking uses address geography only.
      Needed before maps tracking.
- [ ] **Mark huma response fields required** (removes the `FieldsOptionalByDefault` wart in §4).
- [ ] **Auth hardening** — refresh-token/rotation, rate-limit `POST /auth/otp`. JWT is a single
      long-lived token today. (Note: `/auth/otp` has a 30s per-phone resend guard.)
- [ ] **Live Activity push tokens** (ActivityKit) — no storage/endpoint yet.
- [ ] **Observability** — metrics/tracing not wired (documented future work in ARCHITECTURE.md).

### Customer app — core done; remaining
- [ ] **Live Activity / Dynamic Island** for live booking status.
- [ ] **Push notifications** for booking updates.
- [ ] **Profile** (beyond `settings`).

### Provider app — core done; remaining
- [~] **Work photos** — built, but the *upload* needs Cloudinary creds (503 until then; UI degrades
      gracefully).
- [ ] **Maps tracking** with the animated rider marker (`react-native-maps` + the location endpoint
      above) — a cross-app realtime feature (technician broadcasts, customer watches).

### Admin console — core done; remaining
- [ ] **Full service/category creation** (only inline *add-variant* today).
- [ ] **Employees / Customers** views (in the Stitch design; secondary).
- [ ] **Production login** — currently dev-code (devEcho). Needs a real admin auth path.

### Cross-cutting / tooling
- [ ] **Animated glass tab bar** (Reanimated spring zoom + haptics) — deferred from Phase 1.
- [ ] **`@sethu/icons` SVGR pipeline** + branded/service icons.
- [ ] **EAS** build/submit config + OTA update channels.
- [ ] **i18n drift CI** (`i18next-cli status --ci`) so locales can't fall out of sync.
- [x] **CI** — workflows in `.github/workflows/` always run and skip heavy steps when no relevant
      files changed (so the required `backend`/`mobile` checks never hang as "Expected"); import
      `ci/ruleset-main.json` in repo Rules. Optional: shared-Postgres `services:` container to speed tests.
- [ ] **Design polish pass** — premium Apple-HIG styling (layout, spacing, glass, motion). Current
      screens are intentionally plain; the token system makes this a style swap, not a rewrite.

---

## 7. Gotchas (quick reference)

- Backend on **`:8090`**, health at **`/health`**, Postgres on **`127.0.0.1:5434`**.
- **Config/secrets:** `cp .env.example .env` and fill it in — `.env` (gitignored) is auto-loaded on
  startup (`godotenv` in `cmd/api/main.go`; prod-safe, never overrides real env). `.env.example`
  (committed) documents every key. All config is read in `internal/config/config.go`. For local
  testing set `ADDR=:8090`, `SETHU_DEV_OTP=true`, and a `SETHU_DEMO_PHONE`/`SETHU_DEMO_OTP`.
- **Admin console:** `pnpm --filter admin dev` → `localhost:3000` (or 3001 if taken). Admin login is
  phone+OTP; with `SETHU_DEV_OTP=true` the login screen shows the code (no SMS).
- **Demo bypass** = the single `SETHU_DEMO_PHONE` number logs in with the fixed `SETHU_DEMO_OTP`, and
  resolves to whatever role that user has in the DB (customer, or a pre-provisioned technician/admin).
  With `SETHU_DEV_OTP=true`, **any** account can log in — `/auth/otp` returns `dev_code` in its
  response, and the code is also logged. That's also how **dual-OTP** (job start/completion) codes are
  read in dev (LogSender). `/auth/otp` has a **30s per-phone resend guard** (429 if you hammer it).
- **Contract change checklist:** edit handler/query → `make generate` (sqlc) + `make openapi` →
  `pnpm --filter @sethu/api-client run generate` (or `pnpm api:generate`) → the client has the new op.
- `mobile/go.mod` stub, gitignored `ios/`/`android/` (also prettier-ignored) — leave them alone.
- Only one `expo run:ios` build at a time; kill orphans (`pkill -f "expo run:ios"`) before retrying.
- **`sqlc` / `golangci-lint`** install to `~/go/bin`; put it on `PATH` for `make generate`/`make lint`.
- Commit/push only when asked; branch convention `feat/<kebab-scope>`. Integration branch: `developer`.
