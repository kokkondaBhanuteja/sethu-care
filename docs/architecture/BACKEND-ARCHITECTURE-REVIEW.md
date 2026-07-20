# SETHU-CARE Backend — Architecture Review & Standardization

> Principal-architect review of the Go backend (`github.com/kokkondaBhanuteja/sethu-care`, Go 1.26).
> Every statement is grounded in the current implementation (`file:line`), not generic Go advice.
> **No code was changed to produce this document.** It defines the target architecture and an
> incremental, compatibility-preserving path toward it. Companion rules live in [`.ai/`](../../.ai);
> per-package guides live in each package's `CLAUDE.md`.

**Scope reviewed:** `cmd/`, `internal/` (24 packages), `db/{migrations,queries}`, `sqlc.yaml`,
`Makefile`, CI. Excludes `mobile/` (separate monorepo) and generated `internal/storage/sqlcgen`.

---

## 0. Executive summary

This is a **mature, correctness-by-construction modular monolith** — not a codebase in trouble. It
already practices most of what a review like this normally has to *introduce*: bounded contexts with
enforced inward dependencies (depguard), a pure state machine, an append-only ledger, a transactional
outbox, typed money, and **drift tests that pin Go enums to DB CHECK constraints and the OpenAPI spec
to the handlers**. The compiler and the database — not comments — enforce the invariants.

The work here is therefore **formalization and gap-closing**, not rescue:

- **Confirm** the architecture style and write down the dependency rules that are currently only
  partially machine-enforced.
- **Close small consistency gaps**: two enums (`notifications.Channel`, `audit.ActorKind`) escape the
  drift test; event/topic names and Redis key prefixes are bare string literals with no shared
  registry; `internal/order` is a drift-tested enum with no production consumer.
- **Extract a shared kernel** so `identity.Role` stops forcing nearly every layer to import a domain
  package just for an enum.
- **Decide deliberately** on the two conventions that are currently "off on purpose": huma
  `FieldsOptionalByDefault = true` and the absence of list pagination.

**Architecture score: 8.7 / 10** (justified in §16). Deductions are for the shared-kernel coupling,
the un-registried event/key strings, the optional-by-default API schema, and thin observability — all
incremental fixes, none structural.

---

## Phase 1–2 · Architecture identification

### Style: **Modular Monolith with DDD bounded contexts + a Hexagonal edge**

This is a **hybrid**, and the hybrid is intentional. Evidence:

- **Modular monolith / bounded contexts.** One package per context under `internal/`, "module
  ownership" stated in `ARCHITECTURE.md:73-77` and enforced: exactly one service writes a given
  aggregate (`booking`→`bookings`, `ledger`→`ledger_entries`+`payments`, etc. — full map in Phase 5).
  Contexts communicate by **events through the transactional outbox**, not by reaching into each
  other's tables (`internal/app/consumers.go`).
- **Hexagonal (ports & adapters) at the edges.** Outbound integrations sit behind Go interfaces:
  `notifications.Sender` / `sms.Sender` (SMS/push), `verification.Sender`, with dev
  (`LogSender`) vs prod (`MSG91`) implementations chosen in the composition root
  (`cmd/api/main.go:125-131`). `media` (Cloudinary) and `razorpay` are outbound HTTP adapters.
- **Layered dependency direction.** Transport → service/domain → storage; adapters and the kernel are
  leaves. Inward-pointing dependencies are enforced by a **depguard** ruleset
  (`cores-must-not-import-consumers`, `money-is-a-pure-leaf` — `AGENTS.md:98-100`).
- **Not Clean Architecture in the Uncle-Bob sense.** Domain services depend **directly on the
  generated `storage/sqlcgen`** rather than on repository interfaces they define (see Phase 12). This
  is a pragmatic, sqlc-idiomatic choice, not an accident — but it is the single biggest deviation
  from textbook Clean/Hexagonal, and it's why "repository" as a formal layer barely exists here.

### Dependency direction (proven from imports)

```
                 cmd/api ─────────────► (imports everything: the composition root)
                    │
        ┌───────────┴──────────────────────────────────────────────┐
        ▼                                                           ▼
   internal/httpapi  ──► domain services ──► storage(+sqlcgen) ──► Postgres
   internal/auth          (booking, ledger, catalog, identity,
   shared/response         verification, ops, address, reviews,
                           notifications, gateway, audit, outbox)
        │                        │
        │                        ├──► money (pure leaf value object)
        │                        ├──► flow  (Redis primitives, degrades permissively)
        │                        └──► adapters: sms, media, razorpay (outbound HTTP behind ports)
   internal/app ──► wires domain services as outbox consumers (allowed cross-domain assembly layer)
```

### Architecture violations found

**None hard.** No domain/service package imports `httpapi`, `huma`, or `config`; storage imports
nothing internal; `net/http` in `razorpay`/`sms` is outbound-client only, not transport. What exists
are **coupling smells**, all fixable without structural change:

1. **`identity.Role` is a de-facto shared-kernel type trapped inside a domain package.** `booking`,
   `auth`, `ops`, `httpapi` (22 refs) import the `identity` package *only for the `Role` enum and its
   constants* (`booking/permission.go:19-27`, `booking/service.go:72`). This drags a whole bounded
   context into places that want one enum. **Fix (Phase 7):** move `Role` to a shared kernel package.
2. **`ledger → booking` and `ops → booking` compile-time coupling.** `ledger` imports `booking`
   (billing consumes booking types); `ops.New(pool, *booking.Service)` (`ops/ops.go:71`) calls the
   booking service directly for auto-search. Both are deliberate, but they are *direct type/So
   coupling* rather than event coupling — acceptable for `ops` (it's a command surface), worth
   watching for `ledger`.
3. **`internal/order` is dead in production** — imported only by `schema/drift_test.go`. The
   `order.Status` enum is drift-guarded, but `booking.Create` writes `orders` rows directly. Decide:
   promote to a real context or fold the enum into the shared kernel (Phase 5/7).

---

## Phase 3 · Folder responsibilities

Concise per-folder contract. Full versions ship as each package's `CLAUDE.md`. Legend: **Owns** = the
aggregate/table it alone writes; **May import** and **Must not import** define the dependency box.

| Folder | Purpose | Owns (tables) | May import | Must NOT import |
|---|---|---|---|---|
| `cmd/api` | Composition root: load config, wire services + outbox consumers + HTTP, run, shut down gracefully | — | everything | — (it's the top) |
| `cmd/genopenapi` | Emit `api/openapi.yaml` from huma handlers (nil services) | — | `httpapi`, `auth` | domain services (uses nil) |
| `internal/httpapi` | Transport: typed huma operations, auth bridge, rate limit, error→HTTP mapping, raw webhook | — | domain services, `auth`, `money`, `flow` | other transport concerns of domains; DB directly |
| `internal/auth` | JWT signer + Bearer/RBAC middleware; `AuthedUser` in context | — | `identity` (Role), `shared/response` | any domain service, storage |
| `internal/booking` | **Core**: pure state machine, transitions, RBAC+ownership, CAS apply | `bookings`, `booking_items`, `booking_events` (writes `orders`, `outbox`) | `identity`(Role), `money`, `flow`, `audit`, `storage(+sqlcgen)` | `httpapi`, ledger/notifications/ops (consumers) |
| `internal/ledger` | Append-only money: revenue, cash custody/deposit, credits, UPI capture | `ledger_entries`, `payments`, view `technician_cash_position` | `booking`, `money`, `storage(+sqlcgen)` | `httpapi`, `config` |
| `internal/catalog` | Service tree (categories/services/variants/questions) | `categories`,`skills`,`services`,`service_variants`,`question_defs`,`product_*` | `money`, `storage(+sqlcgen)` | any consumer, `httpapi` |
| `internal/identity` | Users, salaried technicians, login OTP, rating recompute, availability/location | `users`, `technicians` (writes `otp_challenges` LOGIN) | `storage/sqlcgen` | any consumer, `httpapi` |
| `internal/verification` | Dual-OTP (START/COMPLETION) + work photos; `Guard` hook | `otp_challenges`(job), `work_photos` | `storage/sqlcgen` | `httpapi`, `booking` |
| `internal/ops` | Manual-assignment queue + candidate ranking; commands via booking | — (cross-reads) | `booking`, `identity`, `money`, `storage/sqlcgen` | `httpapi`, `ledger` |
| `internal/address` | Customer addresses + PostGIS point | `addresses` | `storage(+sqlcgen)` | any consumer, `httpapi` |
| `internal/reviews` | Post-job reviews → `review.submitted` event | `reviews` | `storage(+sqlcgen)` | `httpapi`, `identity` |
| `internal/notifications` | Customer-facing SMS/PUSH voice; outbox consumer; OTP send seam | `notification_log` | `sms`, `storage/sqlcgen` | `httpapi`, other domains |
| `internal/outbox` | Transactional-outbox dispatcher + worker (at-least-once) | `outbox` | `storage(+sqlcgen)` | domain services (dispatch is by string) |
| `internal/gateway` | Idempotent payment-webhook inbox + parked-event replay | `payment_gateway_events` | `storage/sqlcgen` | `httpapi`, `ledger` (passes `CaptureFunc`) |
| `internal/audit` | Who/what/before-after trail; writes inside caller's tx | `audit_logs` | `storage/sqlcgen` | any domain (it's a leaf sink) |
| `internal/money` | `Money int64` (paise) value object — the money kernel | — | — (pure leaf) | **anything** (depguard `money-is-a-pure-leaf`) |
| `internal/flow` | Redis primitives (locks, holds, rate limit, idempotency); degrades permissively | — | `go-redis` only | anything internal |
| `internal/media` | Cloudinary signed-upload signer (SHA1, no SDK) | — | stdlib crypto/http | domains, storage |
| `internal/razorpay` | Razorpay outbound client (order/link creation, signature verify) | — | stdlib http | domains, storage |
| `internal/sms` | SMS `Sender` port + MSG91 impl + `LogSender` | — | stdlib http | domains, storage |
| `internal/order` | `Status` enum only (no service; rows written by booking) | `orders` (no service) | — | — (candidate for kernel/merge) |
| `internal/config` | env → typed `Config`; defaults + parse validation | — | stdlib `os` only (`godotenv` is loaded in `cmd/api`, not here) | **anything internal** (leaf; passed as values) |
| `internal/app` | Assembles domain services into outbox consumers | — | many domains (allowed assembly layer) | `httpapi` |
| `internal/shared/response` | Tiny JSON write helpers | — | stdlib | domains |
| `internal/storage` | pgxpool (`NewPool`), `InTx`, SQLSTATE mapping, testcontainer harness | — | `pgx`, `sqlcgen` | domains, config |
| `internal/storage/sqlcgen` | **GENERATED** type-safe queries/models — never hand-edit | — | `pgx`, `money`, `uuid` | — |
| `internal/schema` | Enum↔DB-CHECK drift tests (test-only) | — | every enum package | production code |

---

## Phase 4 · Dependency rules

Canonical, machine-checkable rules. Some are already enforced by depguard; the rest should be added
(Phase 16). "→" = "may import".

```
Transport      httpapi, auth, shared/response
   ↓
Assembly       app  (outbox consumer wiring — allowed to import many domains)
   ↓
Domain         booking, ledger, catalog, identity, verification, ops,
               address, reviews, notifications, gateway, audit, (order)
   ↓
Adapters       sms, media, razorpay        Kernel   money, flow, config, storage(+sqlcgen)
   ↓
Database       Postgres (PostGIS)
```

**Allowed**

- `cmd/api` → everything (composition root only).
- `httpapi` → domain services, `auth`, `money`, `flow`.
- domain service → `storage(+sqlcgen)`, `money`, its own adapters/ports, the shared kernel.
- `app` → any domain service (assembly layer; explicitly exempt from `cores-must-not-import-consumers`).
- `ops` → `booking` (command surface); `ledger`/`gateway` → `booking` types where documented.

**Forbidden (enforce)**

| Rule | Status |
|---|---|
| domain/service → `httpapi` or `huma` | ✅ holds; add explicit depguard rule |
| domain/service → `net/http` as a **server** (`ServeHTTP`) | ✅ holds (only outbound clients use http) |
| domain/service → `config` | ✅ holds; add explicit depguard rule |
| storage / sqlcgen → any domain or `config` | ✅ holds |
| `money` → anything | ✅ enforced (`money-is-a-pure-leaf`) |
| "core" contexts (order/identity/auth/catalog/address/booking) → consumers (ledger/notifications/verification/ops/reviews/media) | ✅ enforced (`cores-must-not-import-consumers`) |
| booking transition table defined outside `statemachine.go` | ✅ enforced (depguard) |
| any package → `internal/schema` (test-only) | add rule |

**Dependency graph (adjacency, production code):**

```
cmd/api            → (all)
cmd/genopenapi     → auth, httpapi
httpapi            → address auth booking catalog flow gateway identity ledger media money ops razorpay reviews sms verification
app                → identity ledger money notifications ops outbox verification
ops                → booking identity money sqlcgen
booking            → audit flow identity money storage sqlcgen
ledger             → booking money storage sqlcgen
catalog            → money storage sqlcgen
notifications      → sms sqlcgen
auth               → identity shared/response
address reviews outbox → storage sqlcgen
verification identity gateway audit → sqlcgen
leaves (no internal deps): flow money config razorpay media sms order storage sqlcgen shared/response
```

---

## Phase 5 · Domain modeling

### Bounded contexts → aggregates (current, and it maps cleanly)

| Domain | Package | Aggregate root / owned tables |
|---|---|---|
| **Booking lifecycle** (the spine) | `booking` | `bookings` (+`booking_items`, append-only `booking_events`) |
| **Catalog** | `catalog` | `services`/`categories`/`service_variants`/`question_defs`/`skills`/`product_*` |
| **Identity & workforce** | `identity` | `users`, `technicians` |
| **Verification** | `verification` | job `otp_challenges`, `work_photos` |
| **Money / billing** | `ledger` | `ledger_entries`, `payments` |
| **Payments inbox** | `gateway` | `payment_gateway_events` |
| **Addressing** | `address` | `addresses` (PostGIS) |
| **Reviews** | `reviews` | `reviews` |
| **Notifications** | `notifications` | `notification_log` |
| **Audit** | `audit` | `audit_logs` |
| **Messaging infra** | `outbox` | `outbox` |
| **Ops console** | `ops` | none (reads booking/identity; commands booking) |
| **Order** | `order` | `orders` (enum only — no service) |

**Assessment: folder→domain mapping is correct and disciplined.** Two recommendations:

1. **Resolve `order`.** Today it is a floating enum. Either (a) promote to a real `order` context that
   owns `orders` (booking would emit an event instead of writing `orders` directly — cleaner
   ownership), or (b) accept it as a value type and move `Status` into the shared kernel. Given P0
   scope, **(b) now, (a) when payments/refunds grow** is the low-risk call.
2. **`identity.Role` is cross-domain vocabulary, not identity-owned behavior** — extract to kernel
   (Phase 7). This is the one place the otherwise-clean context boundaries leak.

### Booking state machine (the heart of the domain)

Pure `(state, action) → next` over **13 states / 13 actions**, guard-linted so no transition lives
outside `statemachine.go`. Two-layer authorization (role via `CanPerform`, then ownership) runs
*inside* the transaction, before legality, so an unauthorized caller can't probe legality. Applying a
transition is one `storage.InTx`: re-read (state+version) → authorize → optional guard hook (OTP
verify+consume) → pure `Apply` → **optimistic CAS** (`version=version+1 WHERE version=$expected`; 0
rows ⇒ 409 `ConflictError`) → append `booking_events` → `audit.Record` → conditional `outbox` insert.
Double-book is caught by the DB EXCLUDE constraint (23P01 ⇒ 409 `ScheduleConflictError`). Terminal
states (COMPLETED/CANCELLED/FAILED) release the slot. Full transition table: `booking/CLAUDE.md`.

---

## Phase 6 · Constants & enums

### Current state: one excellent pattern, applied to 10 of 12 enums

Every domain enum is `type X string` + closed `const` block + `AllX()` slice + `Valid()` switch
(watched by the **`exhaustive`** linter) + `ParseX()` boundary constructor + `String()`. Stored as
**TEXT + CHECK**, Go constants are the source of truth, and `schema/drift_test.go` reads
`pg_constraint` and asserts Go `AllX()` == the DB CHECK set. **This is the industry-standard string-enum
strategy done right.** No `iota`, no `type X int` — correct, because these values are persisted and
serialized (iota ordinals are fragile across reordering; strings are stable and self-describing).

**When to use which (codify in `.ai/enum-rules.md`):**

- **`type X string` + const block** — any value persisted, serialized, or crossing the API/DB boundary
  (all domain enums here). **Always** add: `AllX()`, `Valid()`, `ParseX()`, DB CHECK, drift test.
- **`iota`** — only for purely in-memory, never-persisted, never-serialized ordinals (e.g. a
  bitmask or internal priority). None qualify today; keep it that way.
- **typed `const` (non-enum)** — fixed domain quantities (TTLs, limits) that deserve a name and type.
- **`var`** — only when a value genuinely can't be const (e.g. `errors.New` sentinels, `regexp.MustCompile`).

### Gaps to close

1. **`notifications.Channel` (SMS/PUSH)** and **`audit.ActorKind` (user/system/gateway)** have **no
   `Valid()`/`ParseX()` and are not in the drift test**, yet both back DB CHECK columns
   (`notification_log.channel`, `audit_logs.actor_kind`). `ActorKind` is also lowercase while every
   other enum is UPPER — a real inconsistency. **Fix:** give both the full pattern + add to
   `drift_test.go`. (`ActorKind` casing is a DB-CHECK-coupled value; change both sides together.)
2. **`gateway` event status** (`RECEIVED/PROCESSED/FAILED`) are unexported string consts, DB-CHECKed
   but not drift-tested. Promote to a typed enum + drift test.

### Magic-value inventory → registries

These are the un-typed string/number literals worth centralizing (locations in the appendix table):

- **Outbox event/topic names** (`booking.created`, `technician.arrived`, … 12 of them) are bare
  strings shared *by literal* between the publisher (`booking/service.go:578`) and consumers
  (`notifications/notifications.go:132`, `app/consumers.go`). A typo in one side silently drops an
  event. **Fix:** a `topics` (or `events`) package of typed `EventName` constants; publisher and every
  consumer reference the constant. This is the highest-value constants fix — it's the module contract.
- **Redis key prefixes** (`lock:`,`rl:`,`idem:`,`hold:`) are inline in `flow/flow.go`. Fine as
  private consts inside `flow`, but they should be **named consts, not inline literals**, so the
  keyspace is greppable.
- **HTTP header names** (`Idempotency-Key`, `X-Forwarded-For`, `Retry-After`, `Authorization`,
  `WWW-Authenticate`, `X-Razorpay-Signature`) are scattered literals. Centralize in a small
  `httpapi/headers.go` const block.
- **Numeric literals** (JWT TTL 24h, OTP TTL/attempts, rate limit 240/min, lock TTLs, HTTP server
  timeouts, credit ₹100) — most already flow from `config`; the rest (OTP params, timeouts, batch
  sizes) should become **named consts** near their owner, not inline magic numbers.

Full enum table and magic-value locations: [appendix](#appendix--enum--magic-value-tables).

---

## Phase 7 · Shared-package strategy

**Principle: not every "shared" thing is a util. Classify by *why* it's shared.** Prevent a
`utils/` dumping ground by giving each shared concern a named home with a one-line charter.

| Bucket | Use it for | In this repo | Rule |
|---|---|---|---|
| **Kernel** (domain vocabulary shared across contexts) | value objects + cross-context enums with no I/O | `money` ✅; **should add**: `Role`, maybe `order.Status`, an `EventName`/topics registry | Pure, no I/O, no deps. This is where `identity.Role` belongs. |
| **Platform / infra** (technical capability, no business rules) | DB pool, tx, Redis primitives, config | `storage`, `flow`, `config` ✅ | Depends on tech libs only; never on domains. |
| **Adapters** (outbound integrations behind ports) | SMS, CDN, PSP | `sms`, `media`, `razorpay` ✅ | Implement a port; swapped in the composition root. |
| **Shared transport helpers** | JSON write, response shaping | `shared/response` ✅ | Transport-only; no domain imports. |
| **Assembly** | wiring domains into consumers | `app` ✅ | The only place allowed broad domain imports. |

**Naming guidance to adopt (in `.ai/`):** prefer a **named capability package** (`money`, `flow`,
`topics`) over generic `pkg/`, `common/`, `utils/`, `helpers/`, `core/`. This repo already avoids the
generic buckets — keep it that way. The one addition: a **`kernel/`** (or reuse the pattern of tiny
named packages) for `Role`, `order.Status`, and the events registry, so domains import *vocabulary*,
not *each other*.

**Recommended new shared packages (all low-risk, additive):**

- `internal/kernel/role` (or `internal/rbac`) — `Role`, constants, `Valid()`, `ParseRole()`. `identity`
  re-exports for compatibility during migration.
- `internal/topics` (or `internal/events`) — typed `EventName` consts for every outbox topic.

---

## Phase 8 · Code duplication

The codebase is notably DRY (single `classify()`, single `RegisterAll`, single `InTx`, one enum
pattern). The **genuine, low-risk** consolidations:

1. **Enum boilerplate** repeats the same `AllX/Valid/Parse/String` shape ~10×. Acceptable Go
   duplication (generics don't help string enums cleanly), but the *two missing implementations*
   (`Channel`, `ActorKind`) should be filled to match — the duplication is the point (consistency).
2. **Event-name strings duplicated across publisher/consumers** — dedupe via the `topics` registry
   (Phase 6). This is duplication that *matters* because the copies must agree.
3. **HTTP header + Redis key literals duplicated** — dedupe via header/key const blocks (Phase 6).
4. **"already exists?" idempotency guards** (`CompletionLedgerExists`, `CreditExistsForOrder`,
   `DepositExistsForBooking`, notification unique index) share a shape. Don't over-abstract — a
   generic "idempotent insert" helper would obscure the DB constraints that actually enforce it. Leave
   as-is; document the pattern instead.

**Do not** introduce a generic repository/BaseService abstraction to "reduce duplication" — it would
fight sqlc and the per-context ownership model. Restraint here is correct.

---

## Phase 9 · Error handling

**Current strategy is strong and coherent — a three-tier model converging on one mapper:**

1. **Sentinel errors** (`var Err… = errors.New("pkg: …")`) — the dominant style, package-prefixed, one
   set per package (`ledger.ErrPaymentNotFound`, `catalog.ErrServiceNotFound`, …).
2. **Typed struct errors** carrying data, compared with `errors.As`: `booking.ConflictError` (→409),
   `ScheduleConflictError` (→409), `ForbiddenError` (→403), `IllegalTransitionError` (→422),
   `UnknownStateError`. Storage translates SQLSTATE (23503/23505/23514/23P01) into these before they
   reach transport (`storage/errors.go`).
3. **Wrapping** — `fmt.Errorf("…: %w", err)` on the way up; `errors.Is/As` walk the chain.

Transport maps **everything through one `classify()`** (`httpapi/errors.go`), delegating to
`classifyAuth` first; ≥500 is logged server-side and returned as an opaque "internal error" (no leak).
Auth messages are deliberately vague (never reveal expired-vs-tampered).

**Recommendations (small):**

- **Make the classify switch exhaustive-safe:** it's a growing `errors.Is/As` chain; add a test that
  every exported domain error type/sentinel has a non-500 mapping (or is intentionally 500), so a new
  error can't silently become a 500.
- **Standardize the missing-resource family:** several packages define their own `ErrBookingNotFound`
  (`booking`, `ledger`, `verification`, `reviews`). They map identically (404). Fine, but document
  that "NotFound" is a *cross-cutting* shape and consider a shared `apperr.NotFound` marker interface
  the classifier checks, so new packages get 404 for free.
- Keep sentinels for value-less conditions, typed errors when the handler needs data — the current
  split is right; write it down (`.ai/` — error rules).

---

## Phase 10 · Configuration

**Current:** one `internal/config/config.go`, plain `os.Getenv` via `stringEnv/intEnv/durationEnv`,
`Config.Load()` returns error only on a malformed present value — **every missing var falls back to a
hardcoded default, boot never fails on a missing key**. `godotenv.Load()` is non-overriding (12-factor
safe). Secrets have no default (empty ⇒ feature degraded/disabled); a dev JWT secret triggers a
runtime warning. Timeouts/limits partly here, partly inline.

**Assessment: appropriate and 12-factor-clean for current scale.** Improvements, in priority order:

1. **Fail fast in production on missing critical secrets.** Today a missing `JWT_SECRET` silently uses
   an insecure dev default (only warned). Add an `APP_ENV`/`SETHU_ENV`; when `production`, `Load()`
   should **error** on empty `JWT_SECRET`, `DATABASE_URL`, and any secret whose feature is required.
   Dev keeps the friendly defaults.
2. **Group config into typed sub-structs** (`Config.JWT`, `Config.DB`, `Config.Razorpay`,
   `Config.Cloudinary`, `Config.OTP`, `Config.RateLimit`) so the inline numeric literals in
   `identity`/`verification`/`main` (OTP TTLs, rate-limit, server timeouts) become **injected config
   with defaults**, not magic numbers.
3. **Feature flags are already implicit** (empty secret ⇒ off). Make them **explicit booleans**
   derived in `config` (`Config.SMSEnabled`, `Config.PaymentsEnabled`, `Config.RedisEnabled`) so
   call sites read intent, not emptiness checks.
4. Keep `os.Getenv` — do **not** add a config framework (viper etc.); it would be over-engineering at
   this size.

---

## Phase 11 · API design

**Current conventions (huma v2 over `http.ServeMux`, OpenAPI 3.1 generated from types):**

- **Contract-first done backwards-correctly:** types → spec → client, with CI drift guards both ways.
  `RegisterAll` is the single op list shared by server, tests, and generator. This is best-in-class.
- **REST resource naming is clean:** collections (`/bookings`, `/services`), sub-resources
  (`/bookings/{id}/transitions`, `/services/{id}/variants`), caller-scoped `/me/*`, admin `/ops/*`,
  `/webhooks/*` (rate-limit + health exempt). State changes are `POST …/transitions` with an action.
- **Status codes are disciplined** (201 creates; 400/401/403/404/409/422/429/500 mapped in
  `classify`). Auth via OpenAPI bearer scheme + per-op role metadata.

**Deliberate gaps to *decide on* (don't drift into them by accident):**

1. **`FieldsOptionalByDefault = true`** (`huma.go:44`) makes **every generated response field
   optional**, forcing `?.`/`??` in the app (`AGENTS.md:134` calls it a "known wart"). **Recommendation:**
   flip to required-by-default for **response** DTOs (mark inputs' optionality explicitly). This is the
   single highest-leverage API fix — it's a contract-quality issue affecting every client field. It's
   a breaking regeneration, so schedule it (Phase 16, "breaking changes").
2. **No pagination/sorting/filtering** — list endpoints return full slices. Fine for catalog and a
   user's own bookings today; **will not scale** for `/ops/*` queues and payments as data grows. Adopt
   a standard **cursor (keyset) pagination** envelope now for admin/ops lists (before they're large),
   even if customer lists stay unpaginated for P0.
3. **No API versioning** (`/v1`). Acceptable while the client is generated in-repo from the same spec
   (they can't drift). **Add `/v1` before any external/public consumer exists** — cheap now, painful
   later.
4. **Idempotency** is opt-in on `POST /bookings` only. Extend the `Idempotency-Key` pattern to every
   non-idempotent POST that creates money or side effects (payments capture, deposits) — the flow
   layer already supports it.

---

## Phase 12 · Database layer

**Strengths (keep as standards):**

- **Optimistic locking** via `version BIGINT` + CAS on the mutable aggregates (bookings especially).
- **Append-only by trigger, not convention:** `forbid_mutation()` rejects UPDATE/DELETE on
  `booking_events`, `ledger_entries`, `notification_log`. Corrections are offsetting rows.
- **Idempotency via unique indexes** (`payments.booking_id`, `reviews.booking_id`,
  `notification_log` partial-unique, `payment_gateway_events.gateway_event_id`) + service-level guards.
- **Enum = TEXT + CHECK + drift test** (Phase 6). **Cross-row invariants in the DB** (EXCLUDE
  double-book via btree_gist; CHECKs that pin money to the right level; composite FK pinning a
  technician's user to `role=TECHNICIAN`).
- **Transactions:** one `storage.InTx` helper with recover-and-rollback; SQLSTATE→domain mapping in
  one place. **Tests run against real PostGIS via testcontainers** — no mocks, no H2.
- **sqlc generated, never hand-edited;** `*_paise → money.Money`, `uuid → google/uuid` via overrides.
- **Query organization:** one `db/queries/<context>.sql` per bounded context; PascalCase verb-first
  names; `FOR UPDATE SKIP LOCKED` for the outbox work-queue.

**Gaps / recommendations:**

1. **No repository interface layer** (services call `sqlcgen` directly). This is a deliberate sqlc
   trade-off (Phase 2). Keep it, but **document the boundary rule** (only a package's own service may
   call sqlcgen for its tables; cross-table reads go through the owning service) and consider **thin
   per-context data-access types** (`bookingStore`) where a service's query surface is large, purely
   for testability seams — not a full repository abstraction.
2. **Migrations are immutable-once-applied but there's no explicit down-migration discipline test.**
   Add a CI step that applies then rolls back the latest migration on a throwaway container.
3. **Audit fields are consistent** (`created_at`/`updated_at`, `actor` on events/audit). No general
   soft-delete (only `users.deleted_at` anonymize) — **correct**; don't add blanket soft-delete.
4. **Index review cadence:** the schema has purposeful partial/GiST indexes. Add a periodic
   `EXPLAIN`-based check for the ops ranking + reconciliation views as data grows.

---

## Phase 13 · Project standards (summary; full rules in `.ai/`)

These codify what the code already does; the `.ai/` files carry the checklists and anti-patterns.

- **Naming:** no single-letter identifiers (enforced by convention + review); PascalCase exported,
  package-prefixed sentinel errors (`booking: …`), verb-first sqlc query names, `type X string` enums
  UPPER_SNAKE values (fix `ActorKind`).
- **Services:** constructor `NewX(pool, …Option)` + functional options; one aggregate per service;
  business validation + status-code selection live in the service, not transport.
- **Handlers (`httpapi`):** thin — decode typed input, call one service method, map error via
  `classify`, return typed output. No business logic, no direct DB.
- **Repository/DB:** only the owning service calls sqlcgen for its tables; all writes to an aggregate go
  through `storage.InTx`; SQLSTATE never leaks past `storage`.
- **Transactions:** state change + its `booking_events`/`outbox` row commit together or not at all.
- **Enums:** the full pattern + DB CHECK + drift test, added on the same PR as the value.
- **Errors:** sentinel for value-less, typed for data-carrying; wrap with `%w`; one transport mapper.
- **Config:** typed, defaulted, fail-fast on prod secrets; no inline magic numbers for tunables.
- **Logging:** `log/slog` JSON, threaded via `Dependencies.Logger`; never log secrets/OTP codes.
- **Concurrency/context:** every service method takes `ctx`; background loops select on `ctx.Done()`;
  outbox consumers idempotent; Redis flow degrades permissively (DB is the guard).
- **Testing:** table-driven; testcontainers for DB; `-race`; drift tests for enums + OpenAPI.
- **DI:** manual constructor injection in `cmd/api`; no container; ports for adapters.

---

## Phase 14–15 · Generated documentation & AI rules

This review ships two companion sets (created as part of this deliverable, no code touched):

- **Per-package `CLAUDE.md`** for every major folder (Purpose · Responsibilities · Allowed/Forbidden
  dependencies · Contains · Examples · Best practices · Common mistakes), grounded in this review.
- **`.ai/` rules directory** — one file per concern (architecture, folder-rules, coding-standards,
  go-style, service/repository/handler/database/api/validation/constants/enum/testing/logging/
  security/performance rules), each with Purpose · Rules · Examples · Anti-patterns · Checklist.

Both derive from this document, so guidance stays single-sourced. `AGENTS.md` remains the operational
map; `ARCHITECTURE.md` the design rationale; this file the architecture standard; `.ai/` the enforceable
rules; `CLAUDE.md` the per-folder contract.

---

## Phase 16 · Migration plan (no rewrite)

Strictly incremental and compatibility-preserving. Ordered by **value ÷ risk**.

### Quick wins (hours; zero breaking change)

1. **✅ DONE — Fill the two missing enums.** Added `AllX()/Valid()/String()/ParseX()` to
   `notifications.Channel` and `audit.ActorKind`, promoted `gateway` status to a typed `Status`
   enum (adding the `FAILED` constant the DB CHECK already allowed), and registered all three in
   `schema/drift_test.go`. Drift test passes against real PostGIS. **`ActorKind` casing kept
   lowercase** to match the existing DB CHECK — changing it is a breaking migration, deferred to the
   breaking-changes bucket, not "fixed" here.
2. **◐ PARTIAL — Name the magic strings/numbers.** Redis key prefixes in `flow` are now named
   consts (`keyPrefixLock/Rate/Idem/Hold`). Still to do: the `httpapi/headers.go` const block and
   pulling inline TTL/limit numbers into config.
3. **Add the missing depguard rules** — domain→`httpapi`/`config` forbidden, `internal/schema`
   import-forbidden. Makes existing good behavior machine-enforced.
4. **Exhaustive-mapping test for `classify()`** — guarantees no domain error silently becomes 500.

### Priority medium (days; additive)

5. **✅ DONE — the `topics` registry.** New pure-leaf `internal/topics` package with a typed
   `EventName` and constants for all 13 outbox topics. Migrated the publisher (`booking/service.go`),
   the reviews publisher (`reviews/service.go`), and all consumers (`app/consumers.go`,
   `notifications` — now a `topics`-keyed `map`) off bare string literals. Same wire values; a
   mistyped topic is now a compile error. Verified end-to-end by the `httpapi` integration suite.
6. **Extract the shared kernel — RECONSIDER.** Moving `Role` to `internal/kernel/role` would make
   the dependency precise, BUT the depguard config deliberately treats `identity` as one of the
   **stable cores the graph points inward toward** (`money, identity, booking`), so wide imports of
   `identity.Role` are by design, not an accident. This is therefore **optional lateral churn with
   marginal benefit** (Go import edges have no runtime cost), not a clear fix. Recommendation: skip
   unless `identity` grows heavy enough that importing it for the enum becomes a real burden. Same
   applies to `order.Status`.
7. **Config hardening** — `APP_ENV`, fail-fast prod secrets, typed sub-structs, explicit feature-flag
   booleans, pull inline tunables into config.
8. **Cursor pagination envelope for `/ops/*` lists** — before those tables grow.

### Breaking changes (schedule deliberately; regenerate client + coordinate mobile)

9. **Flip huma response DTOs to required-by-default** — removes the app's `?.`/`??` wart. Breaking
   client regeneration; do it in one coordinated PR with the mobile `api-client` regen.
10. **Add `/v1` prefix** — before any external consumer. Cheap now.
11. **Promote `order` to a real context** (owns `orders`, booking emits an event) — only when
    payments/refunds justify it; otherwise fold the enum into the kernel and delete the dead package.

### Long-term roadmap

- **Observability:** OpenTelemetry traces + Prometheus metrics + a request-logging middleware (there
  is none today) — the one genuinely missing cross-cutting capability.
- **Repository seams for testability** where query surfaces are large (thin per-context store types),
  without a full repository framework.
- **Down-migration CI check**; periodic `EXPLAIN` review of ops/reconciliation queries.
- **Auth hardening** (refresh/rotation, `/auth/otp` already 30s-guarded) — already tracked in AGENTS.md.

---

## Appendix · Enum & magic-value tables

### Enum inventory

| Type | Values | DB column | Valid/Parse | Drift-tested |
|---|---|---|---|---|
| `booking.State` | 13 (DRAFT…FAILED) | `bookings.state` | ✅/✅ | **No CHECK by design** (pinned by a test) |
| `booking.Action` | 13 (CONFIRM…FAIL) | not stored | ✅/✅ | n/a |
| `order.Status` | PENDING/PAID/REFUNDED/CANCELLED | `orders.status` | ✅/✅ | ✅ |
| `ledger.EntryKind` | REVENUE/CASH_CUSTODY/CASH_DEPOSIT/CREDIT_ISSUED/CREDIT_REDEEMED | `ledger_entries.kind` | ✅/✅ | ✅ |
| `ledger.PaymentMethod` | UPI/CASH/ONLINE | `ledger_entries.method` | ✅/✅ | ✅ |
| `ledger.PaymentStatus` | PENDING/CAPTURED | `payments.status` | ✅/— | ✅ |
| `identity.Role` | CUSTOMER/TECHNICIAN/ADMIN | `users.role` | ✅/✅ | ✅ |
| `catalog.AssignmentMode` | AUTO/MANUAL | `services.assignment_mode` | ✅/✅ | ✅ |
| `catalog.QuestionKind` | TEXT/SINGLE_CHOICE/PHOTO | `question_defs.kind` | ✅/✅ | ✅ |
| `verification.Purpose` | LOGIN/START/COMPLETION | `otp_challenges.purpose` | ✅/✅ | ✅ |
| `verification.WorkPhotoKind` | BEFORE/AFTER | `work_photos.kind` | ✅/✅ | ✅ |
| `notifications.Channel` | SMS/PUSH | `notification_log.channel` | ❌/❌ | ❌ **gap** |
| `audit.ActorKind` | user/system/gateway (lowercase) | `audit_logs.actor_kind` | ❌/❌ | ❌ **gap** |
| `gateway` status | RECEIVED/PROCESSED/FAILED | `payment_gateway_events.status` | private consts | ❌ **gap** |

### Magic-value locations (to registry-ize)

| Value class | Examples | Locations |
|---|---|---|
| Outbox event names | `booking.created`, `technician.arrived`, … (12) | `booking/service.go:578`, `notifications/notifications.go:132`, `app/consumers.go` |
| Redis key prefixes | `lock:`,`rl:`,`idem:`,`hold:` | `flow/flow.go:70,114,133,157` |
| HTTP headers | `Idempotency-Key`,`X-Forwarded-For`,`Retry-After`,`Authorization`,`WWW-Authenticate`,`X-Razorpay-Signature` | `httpapi/{bookings,ratelimit,huma,razorpay_webhook}.go`, `auth/middleware.go` |
| SQLSTATE | 23503/23505/23514/23P01 | `storage/errors.go:11-16` |
| Tunables | JWT 24h; OTP 5/10min, 5 attempts, 30s resend; 240/min; lock 10s/3s; server 5/15/15/60/20s; credit ₹100 | `config.go`, `identity/service.go:22-25`, `verification/service.go:20-22`, `main.go:216-249`, `bookings.go:118,150` |

---

*Sources: `ARCHITECTURE.md`, `AGENTS.md`, and direct code inspection across `cmd/`, `internal/`, `db/`,
`sqlc.yaml`, `Makefile`, CI. This document changed no source code.*
