# Provider (Technician) Workflows

**Persona:** the salaried technician doing the job. · Rules in force: D1–D4 ([index](./README.md)).

The provider's world: **be available, get a job dropped on you, drive, verify with the customer's codes, do the work, prove it with photos, collect payment, settle cash.** No slot juggling, no accept/decline negotiation — assignment is direct.

---

## 1. Availability & location

| Step | Detail | Status |
|---|---|---|
| Go online / offline | `POST /me/availability` — offline = removed from the dispatch pool instantly | [live] |
| Live location | `POST /me/location` updates `technicians.last_lat/last_lng` — **this is what the distance ranking uses (D3)**, so a stale location means wrong-distance assignments | [live] |
| Shift & capacity | Shift hours, max concurrent jobs, service radius are part of the eligibility gates — outside them, never assigned | [live, ranking query] |

## 2. Receiving a job (D3 — direct assignment, no accept step)

- The auto-assigner picks the **best nearby eligible** technician and assigns **directly**: the job simply appears (`ASSIGNED`) with a push notification. There is no request→accept→decline round-trip.
- Can't do it (sick, vehicle broke, wrong info)? → **ESCALATE** from the job [live action]. That returns the booking to the rescue path; it is logged and visible to ops. Repeated escalations show up in performance metrics.
- Double-booking is impossible by construction — the DB EXCLUDE constraint rejects overlapping assignments.
- The job card shows: service + variant, customer name, address (map link), quoted amount, distance/ETA.

## 3. The job lifecycle (the provider drives these transitions)

```
ASSIGNED ──DEPART──► EN_ROUTE ──ARRIVE──► ARRIVED ──[Start OTP]──► IN_PROGRESS
IN_PROGRESS ──work + photos──► REQUEST_COMPLETION ──► AWAITING_COMPLETION ──[Completion OTP]──► COMPLETED
(any pre-completion state) ──ESCALATE──► ESCALATED   (ops takes over)
```

| Step | What the provider does | Backend | Status |
|---|---|---|---|
| Depart | Tap "On my way" | `DEPART` → `EN_ROUTE`; customer sees ETA | [live] |
| Arrive | Tap "Arrived" | `ARRIVE` → `ARRIVED`; triggers the customer's **Start code** SMS | [live] |
| Start | **Ask the customer for the Start code**, enter it | `VERIFY_START` (OTP guard runs inside the transition tx) → `IN_PROGRESS` | [live] |
| Work photos | Capture **BEFORE** and **AFTER** photos — camera → Cloudinary signed direct upload → record | `work_photos` (only the assigned technician may attach) | [live, needs Cloudinary creds] |
| Work done | Tap "Work done" | `REQUEST_COMPLETION` → `AWAITING_COMPLETION`; triggers the customer's **Completion code** | [live] |
| Complete | **Ask for the Completion code**, enter it, pick payment method | `VERIFY_COMPLETION` (+ `payment_method`) → `COMPLETED` | [live] |

**Why the codes matter to the provider:** the Start code is proof of arrival; the Completion code is proof the customer agreed the work was done — it is what makes the payout undisputable. If the customer genuinely can't provide the Completion code (phone dead, left premises), keep trying, log call attempts — after 30+ minutes an **admin** can close it as *Completed (Admin Verified)* using the provider's photos + call log as evidence [target, spec §6.14]. Photos are not optional bureaucracy; they are the provider's evidence.

## 4. Getting paid

| Method | Flow | Status |
|---|---|---|
| **UPI** | Booking-specific QR / payment link shown to the customer; REVENUE is booked only when the payment is **captured** — until then it shows pending | [live] |
| **Cash** | Collect cash → a `CASH_CUSTODY` debt is recorded against the provider (they hold company money) | [live] |
| Cash summary | `GET /me/cash` — collected / deposited / outstanding | [live] |
| Deposit | `POST /me/cash/deposit` — offsets custody; only the holder, only once, only real custody | [live] |
| Earnings view | Day's jobs + amounts in the app; payout runs are back-office (desktop) and never touched from the field | [live UI / payouts out of scope] |

## 5. What the provider never does

| Action | Why |
|---|---|
| Accept / decline / browse jobs | D3 — assignment is direct; the relief valve is ESCALATE, which is logged |
| Reschedule a job | D1 — no rescheduling exists |
| Cancel a booking | Cancellation is customer-window (D2) or admin-emergency only |
| See or enter any OTP on the customer's behalf | The codes go to the *customer*; a provider entering a self-known code would break the trust model |
| Mark their own job complete without the code | Only the evidence-gated **admin** path can close without OTP — never the provider |

## 6. Suspension & standards (ops-facing but provider-visible)

- Admins can **force offline** (instant, reversible), **suspend** (1/3/7/30 days, auto-restores) or **block** — always with a reason shown in the provider app; active jobs are reassigned first, never silently stranded [target, spec §6.19].
- Performance thresholds that matter: completion ≥95%, acceptance —n/a (no accept step) → replaced by **escalation rate**, rating ≥4.5, on-time ≥90% [target metrics adapted from spec §6.16].
- Ratings come from customer reviews (`review.submitted` → rating recompute) [live].
