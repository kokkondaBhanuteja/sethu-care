# SETHU-CARE — Booking Workflow Decisions

**Product decision record v1.0**

| | |
|---|---|
| **Status** | Approved — supersedes the sections listed in §9 |
| **Date** | 21 July 2026 |
| **Owner** | Product |
| **Supersedes parts of** | [`Admin-Mobile-App.md`](./Admin-Mobile-App.md) · [`Product.md`](./Product.md) |
| **Per-persona workflows** | [`workflows/`](./workflows/README.md) — [customer](./workflows/customer-workflow.md) · [provider](./workflows/provider-workflow.md) · [admin](./workflows/admin-workflow.md) |
| **Scope** | Product workflows + screen responsibilities + backend impact map. **No code was changed by this document.** |

---

## 1. Decisions summary

Four product decisions simplify the booking model:

| # | Decision | Rationale |
|---|---|---|
| D1 | **On-demand booking only.** No time-slot selection anywhere. **No reschedule flow** — rescheduling is removed from the product. | A booking is "come now". Slots and rescheduling add planning complexity the product does not need; a customer who wants a different time cancels inside the window (D2) or books again later. |
| D2 | **Customer cancellation only within 1 minute of booking.** After 60 seconds the cancel affordance disappears — dispatch is done and the job is committed. | Dispatch completes within the first minute (D3). Cancelling after a technician has been assigned and is moving wastes provider time and trust. A hard, short, honest window is simpler than fees and penalties. |
| D3 | **Provider assignment is fully automated and location-based.** The system assigns the best nearby provider itself — distance-ranked, auto-widening over rounds. Admin manual assignment is **not** the routine path. | Assignment in minutes, with no human in the loop. The admin's job shifts from "pick a technician for every booking" to "rescue the rare booking automation could not place". |
| D4 | **Customers see only booked (active) and completed jobs.** Cancelled bookings are hidden from the customer's history entirely. | The customer's list is about what is happening and what was done — not a graveyard of cancellations. Cancelled records still exist server-side for ops, finance, and audit. |

**Two retained ops powers (explicitly decided, veto-able):**

- **Admin manual assignment survives only as a last-resort rescue** — used when automated dispatch exhausts every round (§3). It is not part of the normal flow.
- **Admin emergency cancel survives past the 60-second window** — a step-up-gated ops action (fraud, safety, provider no-show). D2 governs the *customer's* affordance, not the platform's.

---

## 2. Revised booking lifecycle

End-to-end flow, mapped onto the **existing** backend state machine
(`internal/booking/statemachine.go` — 13 states, 13 actions; no new states are required):

```
book (customer)                                            state: DRAFT → CONFIRMED
        │
        ▼
┌────────────────────────────┐
│  60-SECOND CANCEL WINDOW   │   customer may CANCEL → CANCELLED (hidden from their list, D4)
│  dispatch runs in parallel │   state: CONFIRMED → SEARCHING (auto, on booking.confirmed)
└────────────────────────────┘
        │  window closes OR assignment lands (whichever the customer sees first)
        ▼
auto-assign best candidate (D3)                            state: SEARCHING → ASSIGNED (system)
        ▼
technician departs / arrives                               ASSIGNED → EN_ROUTE → ARRIVED
        ▼
Start OTP (customer reads code to technician)              ARRIVED → IN_PROGRESS
        ▼
work done → Completion OTP                                 IN_PROGRESS → AWAITING_COMPLETION → COMPLETED
        ▼
payment capture / cash custody · review · history
```

**Failure / rescue branches (unchanged mechanics, new triggers):**

- All dispatch rounds exhausted → `SEARCHING → ESCALATED` (or `FAILED` after admin decision) — admin rescue (§3.4).
- Technician emergency mid-job → `ESCALATED` (existing).
- Admin emergency cancel → `CANCELLED` from any pre-`IN_PROGRESS` state (existing legality; still **no cancel once IN_PROGRESS** — that rule stands).

**State-machine deltas implied (documented here, implemented later — §8):**

| Item | Today | Under this document |
|---|---|---|
| `RESCHEDULED` state + `RESCHEDULE` action | Legal for customers from CONFIRMED/SEARCHING/ASSIGNED/ESCALATED | **Unused by the product.** UI never offers it; `CanPerform` drops it for customers. The state stays in the machine (harmless, and removal would churn the drift-pinned enum) but nothing routes to it. |
| Customer `CANCEL` legality | Allowed from DRAFT…ARRIVED/ESCALATED | **Time-boxed:** customer CANCEL is legal only within 60 s of confirmation. Admin CANCEL keeps current legality. |
| `ASSIGN` actor | Admin only (manual, via ops queue) | **System (nil actor) as the primary assigner**; admin retained for rescue. The state machine already permits nil-actor (system) transitions. |

---

## 3. Auto-assignment algorithm (D3) — "properly and thoroughly"

### 3.1 What exists today (reused, not rebuilt)

- `booking.confirmed` (typed as `topics.BookingConfirmed`, `internal/topics/topics.go`) already
  drives an outbox consumer: `Ops.StartSearch` (`internal/app/consumers.go`) — but today it only
  moves the booking to `SEARCHING` for a human to pick from the ops queue.
- `internal/ops` already has the **candidate ranking query**: filters by city, skill match,
  online status, leave, capacity, and shift hours; orders by **PostGIS distance**, acceptance
  rate, and rating.
- Double-booking is already impossible at the database level: the `bookings_no_double_book`
  EXCLUDE constraint (btree_gist, migration `00015`) rejects overlapping assignments with
  SQLSTATE `23P01` → `ScheduleConflictError` (409).
- Per-technician assignment is already serialized best-effort via the Redis flow lock
  (`booking.WithFlow`, `LockWait("assign:tech:…")`), with the DB constraint as the true guard.

**The change:** the consumer stops stopping at `SEARCHING`. It runs the ranking and **commits the
assignment itself** (system-actor `ASSIGN`), retrying down the ranked list and widening the search
until someone is placed or the rounds are exhausted.

### 3.2 Ranking (location-first)

Ordered filters (hard gates) then score (soft order):

**Hard gates — a candidate must:** be online · not on leave · within the current round's radius ·
hold the required skill for the service category · have capacity (below max concurrent) · be inside
shift hours · have no schedule overlap (the EXCLUDE constraint enforces this at commit anyway).

**Ordering among eligible candidates:**

| Factor | Priority | Source |
|---|---|---|
| Distance (PostGIS, technician location → booking address) | 1st — location is the primary driver | `technicians.last_lat/last_lng` (migration `00014`) vs `addresses.geog` |
| Acceptance rate | 2nd | existing ranking |
| Rating (rolling) | 3rd | `identity.RecomputeTechnicianRating` feed |
| Current load (fewer jobs today first) | tie-breaker | capacity model |

### 3.3 Rounds — auto-widening

| Round | Radius | Wait before next round |
|---|---|---|
| 1 | Base service radius (technician's own configured radius) | ~15 s |
| 2 | +50 % | ~15 s |
| 3 | +100 % (or city-wide, whichever is smaller) | ~15 s |
| exhausted | — | escalate (§3.4) |

Each round: take the ranked list, attempt `ASSIGN` on the top candidate; on a race
(`ScheduleConflictError` / `ConflictError` — someone else took them or the booking moved) fall
through to the next candidate; empty list → next round. Total worst-case is under a minute, which
is what makes the 60-second cancel window (D2) honest: by the time the window closes, dispatch has
genuinely happened or escalated.

**Idempotency (required — outbox delivery is at-least-once):** before doing anything, the consumer
re-reads the booking; if it is no longer `CONFIRMED`/`SEARCHING` (already assigned, cancelled in
the window, escalated), it exits silently. The optimistic `version` CAS makes a duplicate delivery
lose cleanly.

### 3.4 When automation exhausts — admin rescue (the ONLY manual path)

Rounds exhausted → booking `ESCALATED` + critical alert (Admin spec §8.1 "No provider found",
unchanged) → admin's **Assign/Reassign screen (spec §6.10)** is used as the rescue tool — widened
radius, relaxed skill (warned), decliner override — exactly as specified, but reached **only**
from an escalation, never as routine dispatch. The admin spec's §7.1 flow survives intact as the
*exception* path; its manual-first framing is superseded (§9).

---

## 4. Cancellation policy (D2)

### 4.1 Customer cancel — the 60-second window

- Window: **60 seconds from booking confirmation** (`CONFIRM` transition timestamp).
- Inside the window: one-tap cancel, no reason required, full refund if prepaid, no fee.
  A cancel racing the auto-assigner is safe: both sides go through the `version` CAS, so exactly
  one wins; if the cancel wins, an in-flight assignment attempt fails its CAS and exits.
- After 60 s: the cancel affordance is **gone** (button absent — not disabled). Copy on the
  booking screen: countdown "You can cancel for 0:42" during the window; nothing after.
- Server-enforced, not just UI: a customer `CANCEL` arriving after the window is rejected
  (§8 — a time guard beside `CanPerform`). Clock authority is the server.

### 4.2 What replaces late cancellation

| Situation | Path |
|---|---|
| Customer changed their mind after 60 s | Contact support (ticket) — admin may emergency-cancel with reason + step-up |
| Technician never showed | Escalation triggers (spec §8.1) → admin resolves (rescue-assign or admin cancel + refund) |
| Safety issue | Admin emergency cancel — always available pre-`IN_PROGRESS` |

### 4.3 Admin emergency cancel (retained)

Unchanged from Admin spec §6.11 mechanics — step-up biometric, required reason code, refund
decision, audit entry — but repositioned as an **exception tool**: the routine customer path never
needs it. Still impossible once `IN_PROGRESS` (escalate instead; a human decides the money).

---

## 5. Customer-visible history (D4)

- The customer's bookings list shows **two groups only**: **Booked** (all active states:
  CONFIRMED → AWAITING_COMPLETION, plus ESCALATED) and **Completed**.
- **CANCELLED / FAILED bookings never appear** in the customer's list — including their own
  window-cancels. After a cancel, the app returns to Home with a brief confirmation toast, and the
  record is simply absent from history.
- Server-side, nothing is deleted: cancelled/failed rows remain for ops (admin surfaces show
  all states — Admin spec §6.8's Cancelled segment is unaffected), for finance (refund records),
  and for audit (append-only `booking_events` + `audit_logs`).
- Implementation is presentation-layer filtering of `/me/bookings` (§8), not data removal.

---

## 6. User flows (revised)

> **Divided by persona** in [`workflows/`](./workflows/README.md): [customer](./workflows/customer-workflow.md) · [provider](./workflows/provider-workflow.md) · [admin](./workflows/admin-workflow.md). The summaries below are the cross-persona view; the persona docs are the detailed authority.

The Admin spec's six flows (§7), restated under D1–D4. Three change; three are untouched.

### 6.1 Happy path — auto-dispatch (NEW primary flow)

```
Customer books (on-demand, no slot)          → CONFIRMED · 60s cancel countdown visible
booking.confirmed event → auto-assigner      → SEARCHING (system)
Round 1: rank nearby by distance → top candidate → ASSIGN (system) → ASSIGNED
Customer sees technician + ETA (cancel affordance gone at 60s)
DEPART → ARRIVE → Start OTP → work → Completion OTP → COMPLETED
Payment · review · appears under "Completed"
```
No admin involvement. Target: **assignment inside the 60-second window.**

### 6.2 Exhausted dispatch → admin rescue (REVISED from spec §7.1)

```
Rounds 1–3 exhaust (no eligible candidate)   → ESCALATED · critical alert · push (quiet-hours bypass)
Admin: tap push → unlock → booking detail    → Assign screen (spec §6.10) as RESCUE
  widen radius / relax skill (warned) / decliner override → manual ASSIGN
  or: nothing viable → admin cancel + refund → FAILED/CANCELLED (customer never sees it in history)
```
Identical mechanics to spec §7.1 — but reached only on exhaustion, never routinely.

### 6.3 OTP failure → admin-verified completion — **unchanged** (spec §7.3 stands in full: 30-min lock, evidence gates, step-up, 48 h dispute window).

### 6.4 Complaint → refund — **unchanged** (spec §7.4; refunds remain the mobile-permitted finance action).

### 6.5 Provider application → approval — **unchanged** (spec §7.5).

### 6.6 Cold start → first action — **unchanged** (spec §7.6; the <3.5 s critical path matters *more* now, since every admin touch is an exception).

**Deleted flow:** anything involving reschedule or slot selection. There is no §6.x for it on purpose.

---

## 7. Per-screen responsibility deltas

### Dropped entirely

| Screen | Spec § | Why |
|---|---|---|
| Reschedule Booking | 6.12 | D1 — no rescheduling exists |
| Slot pickers / date grids (any surface) | (various) | D1 — on-demand only |

### Demoted to rescue-only

| Screen | Spec § | Change |
|---|---|---|
| Assign / Reassign Provider ★ | 6.10 | Unchanged internally; reachable **only** from an escalation (§6.2 above). No routine entry point from the queue. |
| Re-dispatch | 6.13 | Becomes "re-run automation with widened parameters" — the admin nudges the auto-assigner rather than browsing candidates. |

### Changed

| Screen | Spec § | Change |
|---|---|---|
| Cancel Booking (admin) | 6.11 | Repositioned as emergency-only; mechanics unchanged. Remove "Customer requested" as a routine expectation — post-60s customer requests arrive via support tickets. |
| Booking Detail ★ | 6.9 | Action bar loses Reschedule everywhere; Assign appears only when ESCALATED/FAILED; timeline now shows auto-dispatch rounds ("Round 2 — radius +50% — 6 candidates — top declined") for the "why did this fail" diagnostic. |
| Bookings List (admin) | 6.8 | Unchanged segments (admin still sees Cancelled) — but "Scheduled" segment is removed (D1: nothing is future-dated). |
| Live Dashboard ★ / Needs-Attention | 6.5 / 6.6 | Unchanged structurally; "Avg assign time" KPI now measures the *automation*, and any manual assignment is the anomaly worth noticing. |
| **Customer app — Bookings list** | (customer app) | Two groups only: Booked · Completed. No Cancelled tab, no cancelled rows (D4). |
| **Customer app — Booking screen** | (customer app) | Shows the 60-second cancel countdown, then the affordance disappears (D2). No reschedule action ever (D1). |

### Unchanged
All remaining admin screens (auth, alerts, providers, applications, customers, tickets, refund,
analytics, audit, settings, desktop-only notices) — the density system, step-up model, offline
rules, SLA engine, and audit guarantees of the Admin spec stand as written.

---

## 8. Backend impact map (documented — NOT implemented by this change)

What each decision implies in `internal/`, for when implementation is scheduled. All items follow
the repo's standing rules (state machine only in `statemachine.go`; enum ↔ DB CHECK drift tests;
outbox consumers idempotent; `make openapi` / `make generate` after contract/schema changes).

| # | Change | Where | Notes |
|---|---|---|---|
| 1 | Auto-assign consumer: extend the `booking.confirmed` reaction to rank + system-`ASSIGN` (rounds, widening, candidate fall-through) instead of stopping at `StartSearch` | `internal/ops` (new `AutoAssign`), wired in `internal/app/consumers.go` | Reuses the existing candidates query; idempotent via re-read + `version` CAS; races settle via `ConflictError`/`ScheduleConflictError` (23P01) |
| 2 | 60-second customer-cancel guard | `internal/booking` (`Apply`: time-box customer `CANCEL` against the CONFIRM timestamp from `booking_events`) | Admin CANCEL unaffected; server clock authoritative; new typed error → 403/422 mapping in `internal/httpapi/errors.go` `classify()` |
| 3 | Drop customer `RESCHEDULE` permission | `internal/booking/permission.go` (`CanPerform`) | State stays in the enum (drift test untouched); no UI offers it |
| 4 | Customer history filter | `/me/bookings` handler (`internal/httpapi/bookings.go`) or `ListForCustomer` (`internal/booking/service.go`): exclude CANCELLED + FAILED | Presentation filter only — admin/ops queries unchanged |
| 5 | Cancel-window remainder in API responses (`cancellable_until`) so the app renders the countdown without client clocks | booking create/get DTOs in `internal/httpapi/bookings.go` → `make openapi` → regenerate `packages/api-client` | |
| 6 | Timeline exposure of dispatch rounds (round #, radius, candidate count) | `booking_events` `meta` on system transitions | Feeds Booking Detail's diagnostic timeline (§7) |

Not required: schema migrations (no new states, no new tables), changes to the ledger/payments,
or changes to dual-OTP verification.

---

## 9. Supersedes table

| Source | Section | Status under this document |
|---|---|---|
| `Admin-Mobile-App.md` | §6.12 Reschedule Booking | **Removed** (D1) |
| `Admin-Mobile-App.md` | §6.10 Assign/Reassign as the routine "highest-value action" | **Demoted** to escalation-only rescue (D3); screen spec itself stands |
| `Admin-Mobile-App.md` | §7.1 Failed dispatch → manual assignment | Reframed: automation exhausts first (§3.3); manual only after (§6.2) |
| `Admin-Mobile-App.md` | §6.11 Cancel Booking | Retained as emergency-only; customer cancellation is the 60 s window (D2) |
| `Admin-Mobile-App.md` | §6.8 Bookings List "Scheduled" segment | **Removed** (D1 — nothing future-dated) |
| `Admin-Mobile-App.md` | §6.13 Re-dispatch options | Reframed as parameterised re-run of the auto-assigner |
| `Product.md` | Any slot-selection / reschedule references in booking flows | **Removed** (D1) |
| `Product.md` | Customer booking-history behaviour | Booked + Completed only (D4) |
| Backend (current behaviour, not a doc) | `Ops.StartSearch` stopping at SEARCHING for manual pick | To be extended to full auto-assign (§8.1) |

Neither source document is edited by this record; on their next revision, Product & Design should
fold these decisions in and retire this table.

---

*End of decision record. Questions or changes → Product.*
