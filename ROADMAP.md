# SETHU-CARE — Product Roadmap & Architecture Spec

**Status:** Approved design · **Version:** 2 · **Date:** 2026-07-14
**Supersedes the scope in:** `Product.md`, `AI-Review.md` (both retained as vision/reference)

---

## 1. Executive Summary

SETHU-CARE is an on-demand home-services platform for appliance repair and home
maintenance, operated by an appliance manufacturer. It serves two audiences on one
platform:

1. **Owners of appliances we manufacture** — warranty service, installation, AMC.
2. **The open market** — paid repair for any brand, any home service.

> **This is a first-party service business, not a marketplace.** Technicians are **salaried
> employees**, not gig contractors. The customer pays **the company**, never the technician.
> This single fact removes an entire subsystem — no commission engine, no payouts, no
> per-technician settlement — and it shapes dispatch, payments, and the ledger throughout
> this document.

The long-term product includes a services platform, a direct-to-consumer appliance store,
a subscription membership, and a customer wallet. **This document defines the order in
which those are built, and — more importantly — where each phase stops.**

The core strategic bet: **service is the moat, commerce is the existing business.** The
platform makes our appliances more valuable by guaranteeing service. It does not need to
be the till they are sold through on day one.

---

## 2. Constraints (these drive every decision below)

| Constraint | Value |
|---|---|
| Nature of launch | Real business — real customers, real technicians, real money |
| Team | 1–2 developers |
| Time to launch | ~3 months |
| Launch geography | 1 city at launch → 3 cities after auto-dispatch |
| Technician bench | Up to ~50, **salaried employees** |
| Money flow | **UPI to company account = primary.** Cash = fallback, held in technician custody, reconciled by admin. |
| Dispatch | **Broadcast offer, first-accept-wins** (decided; see §5) |

**Effective capacity is ~24–26 developer-weeks.** The services platform alone consumes
essentially all of it. Everything else is a later phase. This is not pessimism; it is the
measured shape of the work, and it is the reason this document exists.

---

## 3. Scope Decisions

### 3.1 What we are building

The full vision in `Product.md` — services platform, dispatch, dual-OTP, commerce,
membership, wallet — is retained. It is sequenced, not cut.

### 3.2 What we are explicitly refusing (and why)

| Refused | Why |
|---|---|
| Kafka, Kubernetes, Elasticsearch, gRPC, Terraform | Infrastructure for 50 engineers and a million bookings. We have 2 engineers and zero bookings. Postgres carries us to a scale we would be thrilled to reach. |
| Microservices | Decoupled ≠ distributed. With 2 devs, separate deployables buy distributed coupling — the worst kind — and spend the budget on plumbing. |
| **Commission engine, payouts, technician settlement** | **Technicians are salaried.** Money never flows from company to technician per-job. Entire subsystem deleted. |
| Bespoke design system | Use a component library. Spend taste on the booking flow, not on buttons. |
| Admin mobile app (4th interface) | A responsive admin web works on a phone. We will likely never need this. |
| Live GPS map tracking (in v1) | For a *scheduled home visit*, "on the way, arriving ~3:20pm" plus a call button delivers ~90% of the value. Nobody waits at the kerb for a fridge mechanic. Deferred to P5. |
| 18-state booking machine | Trimmed to 13. See §7. |
| Full upfront spec suite (ER diagrams, REST spec, analytics taxonomy, error catalog, offline-sync strategy) | See §11. These are a **communication protocol for a large team.** With 2 devs, most are ceremony that would cost a third of the runway. |

Each refusal can be revisited **individually**, when a real bottleneck forces it —
precisely because the modular walls (§4) give us the seams to do so.

---

## 4. Architecture — The Spine

### 4.1 Modular monolith

**One deployable, one database, hard internal walls.** Modules own their own tables and
communicate only through defined contracts and domain events. Nothing reaches into another
module's data.

This delivers everything phased delivery requires — swap a module, phase in a feature,
test in isolation — with none of the operational tax of distribution. When a module
genuinely outgrows the box (Assignment is the likely first), it lifts out along the seam
already built.

### 4.2 Modules and aggregate ownership

**Ownership rule:** exactly one module may write to an aggregate. Everyone else reads via
its contract or reacts to its events. This is what keeps the walls real.

| Module | Owns (aggregates) | May write |
|---|---|---|
| **Identity** | User, Technician (employee record, skills, capacity), Customer | Identity only |
| **Catalog** | Category, Service, ServiceVariant, PricingRule, QuestionDef | Catalog only |
| **Products & Warranty** | ProductModel, ProductUnit (serial), Warranty, Ownership | Products only |
| **Booking** | **Booking, BookingItem, BookingEvent** — *the spine* | Booking only |
| **Assignment** | Offer, TechnicianLocation | Assignment only |
| **Verification** | OtpChallenge, WorkPhoto | Verification only |
| **Pricing** | Quote, Discount *(the hook)* | Pricing only |
| **Ledger & Payments** | LedgerEntry, Payment, CashCustody, Credit | Ledger only |
| **Notifications** | NotificationLog | Notifications only |
| **Reviews** | Review | Reviews only |
| **Ops** | *(no aggregates — reads all, commands via contracts)* | — |
| **Commerce** *(P3)* | Order, OrderItem | Commerce only |

### 4.3 Booking is the spine — but NOT a god aggregate

Booking is the **source of truth for the job's lifecycle** and the **publisher of the events
everything else reacts to.** It is *not* a container.

Assignment, Payment, OTP, Notification, Review, and Invoice **listen to Booking. They do not
live inside it.**

> **Why this matters:** if those lived inside a Booking aggregate, `BookingService` becomes
> three thousand lines touching every table — and **the Assignment port becomes impossible.**
> You cannot swap manual dispatch for auto dispatch if dispatch lives inside Booking. The
> god-aggregate is precisely the thing that kills phased delivery.

### 4.4 The Assignment port — why manual-first is correct

Assignment exposes one contract: *given a confirmed booking, produce an assigned
technician, or escalate.* Booking (upstream) and Notifications/Verification (downstream)
know only that contract.

- **P1 — `ManualAssignment`:** booking lands in an admin queue; a human picks a technician
  from a list sorted by distance, skill, and **capacity**.
- **P2 — `OfferEngineAssignment`:** PostGIS finds eligible technicians nearby; tiered
  broadcast offers; first accept wins; widen if declined — **and when the ladder is
  exhausted, it calls `ManualAssignment`.**

**The manual assignment built in P1 is not a throwaway prototype. It becomes the permanent
fallback path of the auto engine in P2.** Every dispatch system that survives contact with
reality has a human escape hatch — for the 11pm booking nobody takes, the technician whose
phone is dead, the address that geocodes to a lake. We build the escape hatch first, run the
business on it, learn what "good match" actually means in our cities, then automate the
common case with real data instead of guesses.

### 4.5 Assignment mode is a property of the service, not the system

`services.assignment_mode = 'auto' | 'manual'` — a **column in the catalog**, changeable by
ops without a deploy.

- **Repair jobs → `auto`** (the offer engine).
- **Product delivery + installation → `manual`** — admin sees the order and assigns a
  technician deliberately, because delivering a refrigerator involves stock, a vehicle, and
  a staircase.

**Consequence: P3's delivery/installation needs *zero* new dispatch work.** It reuses the
manual queue built and hardened in P1. An installation is simply a job that happens to be
assigned by a human. *The decision to build manual first keeps paying rent.*

### 4.6 The seam rule

> **Build the seam in the phase before you need it. Never the feature.**

A seam is an interface and an event — cheap. The feature behind it costs months.

- Pricing exposes a discount hook → **subscription (P4)** is a new discount provider, not a rewrite.
- Ledger records credits → **wallet (P4)** is a new balance view over an existing ledger, not a new money system.
- Products consumes `appliance.sold` → **commerce (P3)** wires in without touching warranty logic.
- Assignment is a port → **auto-dispatch (P2)** replaces manual without touching Booking.

---

## 5. Dispatch (P2)

### 5.1 Technician eligibility — the capacity model

Distance alone is **not** availability. A technician is eligible only if **all** hold:

| Factor | Check |
|---|---|
| Skill | Holds the skill the service requires |
| Online | Currently marked online |
| Working hours | Within their shift |
| Leave status | Not on leave |
| Service radius | Job is within *their* configured radius |
| Concurrent jobs | Below their max-concurrent-jobs limit |
| Current workload | Not mid-job (unless the service permits overlap) |

Only then do we **rank** by: distance → **acceptance rate** → rating.

### 5.2 The escalation ladder

All tiers are **production-tunable config** (radius, window, batch size, SLA) — not code.

| Tier | Behaviour |
|---|---|
| **1 — Best match** | Broadcast offer to top 3–5 **eligible** technicians within primary radius (~5 km). First to accept wins. Window ~45–60s. |
| **2 — Widen** | Broaden radius (~10 km), relax ranking, offer to next set. |
| **3 — Widen again** | City-wide sweep. Last automated attempt. |
| **4 — Human** | **Two things happen at once** (see below). |
| **5 — Terminal** | If ops cannot place it within SLA: offer a **reschedule** to a staffable slot, or **cancel with apology + wallet credit**. |

First-accept-wins is enforced with a **Redis lock** — two technicians must never win the
same job.

### 5.3 Tier 4 does two things simultaneously — this is load-bearing

1. **The booking is auto-pushed into the admin queue**, flagged for a human, with an SLA
   timer. Ops sees it and works the phones **without waiting for the customer to act.**
   *The system chases us; we do not wait to be chased.*
2. **The customer is told the truth immediately** in-app — *"We're personally arranging a
   technician for you — we'll confirm within 15 minutes"* — **with a tap-to-call office
   number** for anyone who wants a human now.

**Why both:** if the only escalation is "customer calls us," every customer who doesn't
bother to call is a booking that dies silently — and we never find out. The helpline is a
*comfort for anxious customers, not the load-bearing beam of dispatch.*

**Why Tier 5 must exist:** a booking that sits in "searching…" for six hours is worse than
an early, honest "we can't do 2pm — can we do 6pm?" Customers forgive limits. They do not
forgive being strung along.

### 5.4 The accountability guardrail (this is what makes broadcast work here)

A broadcast auction works for Rapido because gig drivers **earn per ride** — accepting is
money, so they race. **A salaried technician earns the same whether they accept the 8pm job
across town or ignore it.** Left unguarded, hard jobs get quietly ignored by everyone and
flood the admin queue — and the engine buys nothing.

**The fix is one column.** Every offer records its outcome: `accepted` · `declined` (with
reason) · **`ignored`**. Each technician carries a visible **acceptance rate**, surfaced to
ops.

Ignoring a job stops being free and anonymous the moment it is **counted and visible to
their manager.** Salaried employees respond to accountability, not to auctions. The same
column doubles as a ranking signal in §5.1 — technicians who accept get offered first.

---

## 6. Money

**Customers pay the company. Technicians are salaried. Money never flows company → technician
per job.**

| Path | Behaviour |
|---|---|
| **UPI (primary)** | Technician's app shows a **booking-specific company UPI QR**. Customer scans. Money lands **directly in the company account**. The technician never touches it. |
| **Cash (fallback)** | Recorded as `CashCustody` against that technician. They are now **holding company money** and must deposit it. |
| **Online prepay** | Razorpay payment link (P1) → full checkout (P3). |
| **Warranty job** | Price resolves to zero. No payment step at all. |

### The admin cash reconciliation screen (P1)

For each technician: **collected · deposited · outstanding.** The gap is visible and ageing.
This is the cross-check — without it, cash-in-pocket becomes shrinkage you cannot prove.

### Ledger rules

`ledger_entries` is **append-only. Never mutate a row; correct with an offsetting entry.**
This avoids the classic startup catastrophe of a `balance` column that drifts from truth and
can never be reconciled.

---

## 7. Booking State Machine (13 states)

```
DRAFT → CONFIRMED → SEARCHING → ASSIGNED → EN_ROUTE → ARRIVED
      → IN_PROGRESS → AWAITING_COMPLETION → COMPLETED
```

Plus four that keep us honest: **`ESCALATED`** (the human queue), **`RESCHEDULED`**,
**`CANCELLED`**, **`FAILED`** (terminal — nobody could be found; automatic credit issued).

### Why 13 and not Product.md's 18

`Provider Requested`, `Provider Accepted`, and `No Response` are **not booking states** —
they are the lifecycle of an **Offer**. One booking generates many offers across three
tiers. Modelling offers as their own aggregate keeps the booking clean. Likewise
`Waiting Start OTP` is not distinct from `ARRIVED` — arrival *is* the state of waiting for
that OTP.

This is not pedantry. Every state multiplies the UI cases, notification rules, and
transitions to be tested. **Thirteen states we fully understand will ship; eighteen we
half-understand will leak bugs into people's kitchens.**

Every transition writes an immutable row to `booking_events`.

---

## 8. Event Catalog

The published contract between modules. Notifications, analytics, and future integrations
consume these — nothing reaches into another module to find out what happened.

| Event | Emitted by | Consumed by |
|---|---|---|
| `booking.created` | Booking | Pricing, Notifications |
| `booking.confirmed` | Booking | **Assignment**, Notifications |
| `offer.sent` | Assignment | Notifications |
| `offer.accepted` | Assignment | Booking, Notifications |
| `offer.declined` / `offer.ignored` | Assignment | Identity *(acceptance rate)*, Ops |
| `booking.assigned` | Booking | Notifications, Verification |
| `technician.en_route` | Booking | Notifications |
| `technician.arrived` | Booking | **Verification** *(issue start OTP)*, Notifications |
| `otp.start_verified` | Verification | Booking |
| `booking.started` | Booking | Notifications |
| `otp.completion_verified` | Verification | Booking |
| `booking.completed` | Booking | **Ledger**, Reviews, Notifications |
| `payment.captured` | Ledger | Booking, Notifications |
| `cash.collected` | Ledger | Ops *(reconciliation)* |
| `booking.escalated` | Assignment | **Ops**, Notifications |
| `booking.failed` | Booking | Ledger *(issue credit)*, Notifications |
| `review.submitted` | Reviews | Identity *(technician rating)* |
| `appliance.sold` *(P3)* | Commerce | **Products & Warranty**, Booking *(auto-book install)* |

---

## 9. Data Model (by module)

| Module | Tables |
|---|---|
| Identity | `users` (role), `technicians` (skills, **shift hours, leave, service_radius, max_concurrent_jobs, acceptance_rate**), `customers` |
| Catalog | `categories`, `services` (**`assignment_mode`**), `service_variants`, `pricing_rules`, `question_defs` |
| Products & Warranty | `product_models`, `product_units` (serial), `warranties`, `ownerships` |
| Address | `addresses` (PostGIS geography point) |
| Booking | `bookings`, `booking_items`, `booking_events` (append-only) |
| Assignment | `offers` (tier, technician, sent_at, expires_at, **outcome**), `technician_locations` (PostGIS point, heartbeat) |
| Verification | `otp_challenges` (hashed, expiring, rate-limited, attempt-capped), `work_photos` |
| Pricing | `quotes`, `discounts` (the hook) |
| Ledger | `ledger_entries` (append-only), `payments`, **`cash_custody`**, `credits` |
| Reviews | `reviews` |
| Commerce *(P3)* | `orders`, `order_items` |

**A booking may reference a `product_unit`** — that is how Pricing knows a job is under
warranty and therefore free.

**Nearby-technician query** is a single indexed `ST_DWithin` over `technician_locations`,
filtered by the §5.1 capacity predicates.

---

## 10. Stack

| Layer | Choice | Rationale |
|---|---|---|
| Database | **PostgreSQL + PostGIS** | Relational, transactional, money-touching data + a geospatial query at the heart of dispatch. Not a close call. |
| Cache/Queue | **Redis** | Offer timers, retries, first-accept-wins locking (P2). |
| **Backend** | **Java 21 LTS + Spring Boot 3.x + Spring Modulith** | **We build in the language we are strongest in.** Spring Modulith *verifies the module walls of §4 in a test* and gives us the domain-event bus with transactional publication. It is the architecture in this document, first-class. |
| Persistence | **Spring JDBC (`JdbcClient`) + Flyway** | The hottest query is a hand-written `ST_DWithin`. Do not fight Hibernate over PostGIS — write the SQL. Flyway owns migrations. |
| API contract | **springdoc-openapi → `openapi-typescript`** | The OpenAPI spec is generated from the controllers; the mobile and admin apps generate TS types from it. One source of truth across four surfaces. |
| Mobile | **Expo / React Native + TypeScript** | Customer app + technician app, one monorepo, shared UI package. |
| Admin | **Next.js + Tailwind + shadcn/ui** | Responsive — also serves as "admin mobile." |
| Payments | **Razorpay** (official Java SDK) | UPI QR + payment links (P1); full checkout (P3). |
| SMS / OTP | **MSG91** | |
| Push | **Firebase Admin SDK** (Java) | |
| Maps | **Google Maps** | Geocoding + **deep-link navigation**. We do not build a map in P1. |
| Storage | **S3 / Cloudflare R2** | Work photos. |
| Errors | **Sentry** | No Prometheus/Grafana stack yet. |
| Hosting | **Docker on a single managed host** | No Kubernetes. |

> **Why not Go, and why not Node.** Go is a fine fit technically — but the team's fluency is
> in Java/Spring, and Go's advantage here (a ~300MB smaller memory footprint) is worth about
> **$10/month** at our scale. That is the entire prize. The cost would be building a
> money-handling business on a 3-month deadline in a second language. *We optimise for the
> scarce resource (our time and correctness), not the abundant one (server RAM).* Node was
> rejected on the same fluency grounds. Revisit only if the team changes.

---

## 11. Documentation Policy

An external review recommended producing, *before any coding*: a complete ER diagram, domain
model, booking and dispatch sequence diagrams, a REST API specification, an event catalog, a
permission matrix, an analytics event taxonomy, an error code catalog, an offline
synchronisation strategy, and a push notification specification.

**That review explicitly assumed "a 6–10 person engineering team." We have one to two
developers.** Those artifacts are a *communication protocol for a large team*; with two devs
who talk daily, most are ceremony that would consume a third of the runway to launch.

| Artifact | Verdict |
|---|---|
| **Event catalog** (§8) | **Do in P0** — it's a decision, not documentation |
| **Permission matrix** (Customer / Technician / Admin) | **Do in P0** — a decision |
| **Aggregate ownership map** (§4.2) | **Do in P0** — a decision |
| API spec | **Emerges from the code.** Generate from the endpoints actually built. |
| Error code catalog | Alongside the code |
| Analytics taxonomy | Alongside the code; `booking_events` already captures the truth |
| ER diagram | Generate from the schema, don't hand-draw |
| **Offline sync strategy** | **Deferred.** We do not yet know which technician screens need it. Guessing now = designing for invented problems. |
| Design system | Separate document, later phase |

---

## 12. The Phase Ladder

> **A phase ends when its exit criteria are *measured*, not when the code feels done.**
> Each phase has an explicit stop line so that "just one more feature" cannot quietly eat
> the schedule.

### P0 — Foundation & the Booking Spine · ~3 weeks
*Nothing to demo. Everything depends on it.*

**Ships:** Modular monolith skeleton with enforced module walls. Postgres + PostGIS + Redis.
OTP auth for all three roles. HSOS catalog tree (incl. `assignment_mode`) seeded with the
first 4–5 services. Technician model **with the full capacity fields**. Addresses +
geocoding. **The booking state machine** — every state, every legal transition, every
emitted event, ruthlessly tested. Append-only ledger skeleton. **Event catalog, permission
matrix, aggregate ownership map.** Bare admin shell.

**Stop line:** No apps. No design system. No dispatch. No payments. *Resist building UI here
— the temptation will be enormous.*

**Exit criteria:** From the admin shell, a booking can be driven through **every** state and
**every** failure path, and the state machine **rejects every illegal transition**.

---

### P1 — Manual-Assignment MVP · ~5 weeks · **← THIS IS THE LAUNCH**
*One city. Real customers. Real money. Ops assigns by hand.*

**Ships:**
- **Customer app:** browse catalog, book (instant + scheduled), addresses, live status,
  history, rate.
- **Technician app:** online/offline, receive assignment, navigate (deep-link to Google
  Maps), start OTP, work photos, completion OTP, **UPI QR collection**, job history.
- **Admin:** the **assignment queue** with a technician picker sorted by distance, skill and
  capacity; booking board; technician management; **cash reconciliation screen**.
- Dual OTP + photo evidence.
- **Payments: UPI QR (primary) → company account. Cash (fallback) → custody + reconciliation.**
- Push + SMS notifications.
- **Warranty-aware pricing** — if the serial is in warranty, the job is free.

**Stop line:** No auto-dispatch. No live GPS map. No wallet top-up. No subscription. No
commerce. No bespoke design system.

**Exit criteria:** ~100 completed jobs in one city · under 5% of bookings failing to be
assigned · OTP completion working in the wild · **cash custody reconciles to zero gap.**

**→ We are a real business at ~week 8.**

---

### P2 — The Auto-Dispatch Offer Engine · ~3 weeks
*The leash comes off. Then — and only then — three cities.*

**Ships:** Technician live location. PostGIS eligibility query with the **full capacity
model** (§5.1). Tiered **broadcast** offers with Redis timers and first-accept-wins locking.
**Offer outcome tracking + per-technician acceptance rate** (§5.4). The full escalation
ladder (§5.2), reusing the admin queue already battle-tested in P1. Customer "arranging
personally" message + tap-to-call. All tiers configurable in production.

**Stop line:** No ML ranking. No ETA prediction. No surge pricing. Rank by distance,
acceptance rate, and rating — three columns, sorted.

**Exit criteria:** **>70% of bookings assigned with zero human touch** · decline/ignore
reasons logged · **no technician's acceptance rate is quietly collapsing.**

**→ Only after this do cities two and three open.** Launching three cities on manual
assignment would drown ops.

**→ ~Week 11. That is the three months, and it ends with a live, self-running, multi-city
service business.**

---

### P3 — Commerce, Delivery & Warranty Depth · ~5–6 weeks

**Ships:** The appliance store — browse, checkout, and the strategic payoff: **buying an
appliance automatically books its delivery + installation and registers its warranty.**
AMC / service plans attached to a product. Basic spare-parts tracking.

**Delivery model:** **our own technicians deliver and install.** Assignment mode is
`manual` — admin assigns deliberately (§4.5). **No courier integration. No new dispatch
work.** An installation is just a job.

**Stop line:** No third-party-seller marketplace. No returns automation — ops handles
returns by hand until volume proves it hurts.

---

### P4 — The Monetisation Layer · ~4 weeks

**Ships:** Subscription membership (slots into the Pricing discount hook from P0 and touches
nothing else). Wallet top-up + cashback. Coupons and referrals.

**⚠ This phase begins with a legal review, not a sprint.** A wallet holding only credits we
issue, spendable only on our platform, is a *closed-loop* instrument — comparatively simple.
**The moment customers top it up with their own money, we are holding public funds**, which
in India engages RBI prepaid-instrument rules, escrow/nodal handling, and KYC questions.
*Verify specifics with a payments lawyer. A "wallet" is not a UI screen.*

**Stop line:** None of this is worth building before there are repeat customers to sell it
to. **A membership monetises repeat behaviour; it cannot create it.** If retention is bad,
fix retention.

---

### P5 — Scale & Intelligence · ongoing

Live GPS tracking on a map. Smarter ranking (acceptance prediction, ETA modelling). Demand
forecasting and slot pricing. Real analytics/BI. Lifting Assignment out of the monolith **if
and only if** it is actually straining. The admin mobile app — *which we likely never build.*

---

## 13. Timeline Summary

| Phase | Duration | Cumulative | Milestone |
|---|---|---|---|
| P0 | ~3 wks | wk 3 | Booking spine provably correct |
| P1 | ~5 wks | **wk 8** | **LAUNCH — 1 city, manual assignment** |
| P2 | ~3 wks | **wk 11** | **Self-running dispatch → 3 cities** |
| P3 | ~5–6 wks | ~wk 17 | Commerce + delivery + warranty chain |
| P4 | ~4 wks | ~wk 21 | Membership + wallet |
| P5 | ongoing | — | Scale & intelligence |

---

## 14. Known Risks

| Risk | Mitigation |
|---|---|
| **P1 at 5 weeks is aggressive.** Two apps + admin in 5 weeks is only possible because P0 did the backend properly and we use an off-the-shelf component library. | **The launch date is the flexible thing. The scope is not.** If it slips, it slips to 6–7 weeks. |
| **Broadcast auction with salaried staff** — no financial incentive to accept; hard jobs get ignored | **§5.4 accountability guardrail.** Offer outcomes logged, acceptance rate visible to ops. Watch this metric closely in P2; if it degrades, switch to direct-assign-with-acknowledgement (the Assignment port makes this a swap, not a rewrite). |
| **Cash shrinkage** | UPI is primary. Cash creates a tracked custody balance with an ageing admin reconciliation screen. |
| Scope creep into P0–P2 | The bar for adding anything is now explicitly very high. Everything in the vision still gets built — just in an order where each phase is independently usable by real customers. |
| Wallet regulatory exposure | Legal review gates P4. Credits-only ledger in P1 carries no such exposure. |
| Technician supply too thin for auto-dispatch | P2's exit criteria measure this directly. If <70% auto-assign, the answer is supply, not code. |
| Dispatch tuning is guesswork | P1 runs manual assignment on real jobs — generating exactly the data needed to tune P2's ranking. This is a *feature* of the ordering. |

---

## 15. Open Questions

1. **Launch city** — which of the three goes first? (Drives technician recruitment.)
2. **Service catalog at launch** — which 4–5 services seed P0? (Recommend the highest-volume
   warranty-service categories, since those customers already exist.)
3. **Existing appliance-buyer base** — is there a list of past buyers to seed demand? If
   substantial, it strengthens the case for pulling membership (P4) earlier.
4. **Stock location (P3)** — where do technicians collect appliances for delivery? Company
   warehouse per city, or dealer premises? Affects `assignment_mode: manual` job design.

### Resolved

- ~~Commission model~~ → **None. Technicians are salaried; customers pay the company.**
- ~~Delivery model~~ → **Own technicians deliver + install, manually assigned.**
- ~~Dispatch mechanism~~ → **Broadcast, first-accept-wins, with the §5.4 accountability guardrail.**
- ~~Payment method~~ → **UPI to company account primary; cash fallback with custody reconciliation.**
