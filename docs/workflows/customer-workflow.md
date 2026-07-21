# Customer Workflows

**Persona:** the person booking a home service. · Rules in force: D1–D4 ([index](./README.md)).

The customer's world is deliberately simple: **book now, watch it happen, verify with two codes, pay, rate.** No slots, no rescheduling, no cancellation beyond the first minute, no cancelled clutter in history.

---

## 1. Sign in

| Step | Detail | Status |
|---|---|---|
| Phone + OTP login | `POST /auth/otp` → `POST /auth/verify` → JWT (secure-stored) | [live] |
| First login | Creates the CUSTOMER account automatically | [live] |
| Delete account | `DELETE /me` — anonymize-in-place | [live] |

## 2. Book a service (on-demand — D1)

```
Home → browse categories → service detail (variant, price) → address → Book Now
```

| Step | Detail | Status |
|---|---|---|
| Browse catalog | Categories → services → variants with `From ₹` pricing | [live] |
| Pick address | Saved addresses (PostGIS point); first address auto-default | [live] |
| Create booking | `POST /bookings` (supports `Idempotency-Key`) → `DRAFT` → `CONFIRM` → `CONFIRMED` | [live] |
| **No slot picker** | There is no date/time selection — the booking means *now*. Price is computed server-side from the variant, never from the client. | rule D1 |

## 3. The 60-second cancel window (D2)

- After booking, the screen shows a **countdown: "You can cancel for 0:42"** with a one-tap Cancel.
- Inside the window: cancel is free, no reason asked, full refund if prepaid. The booking then **disappears from history entirely** (D4) — the app returns Home with a confirmation toast.
- At 0:00 the affordance **disappears** (not disabled — gone). Dispatch is done; the job is committed.
- Changed your mind after 60s? → contact **support** (ticket); an admin can emergency-cancel with a reason. There is no self-service late cancel.
- Server-enforced: a late `CANCEL` call is rejected regardless of UI [target — cancel-window guard, decision record §8.2]. The countdown value comes from the API (`cancellable_until`) so client clocks don't matter [target §8.5].

## 4. Watch dispatch happen (D3 — nothing to do)

While the countdown runs, the system is already assigning: distance-ranked candidates, auto-widening rounds (~15s each). The customer never sees a "pick a provider" step.

| What the customer sees | Backend state |
|---|---|
| "Finding your technician…" | `SEARCHING` |
| Technician card (name, photo, rating) + ETA | `ASSIGNED` |
| "On the way" with live location | `EN_ROUTE` [live states; live map target] |
| "Arrived" | `ARRIVED` |
| Rare: "We're personally arranging your technician" | `ESCALATED` (admin rescue — invisible mechanics) |
| Rare: couldn't find anyone → sorry + **goodwill credit** | `FAILED` → credit auto-issued (`ledger.IssueFailureCredit`) [live]. The failed booking itself never shows in history (D4) — only the credit + notification. |

## 5. Verify the work — dual OTP (unchanged, trust core)

| Moment | Customer's job |
|---|---|
| Technician arrived | Customer receives a **Start code** by SMS → reads it to the technician → work begins (`IN_PROGRESS`) |
| Technician says work is done | Customer receives a **Completion code** → shares it **only when satisfied** → `COMPLETED` |
| Codes | 6-digit, 10-min expiry, attempt-capped, bcrypt-hashed server-side [live] |
| Can't share the code? | If unreachable >30 min the admin may close it as **Completed (Admin Verified)** — the customer is notified and gets a **48-hour dispute window** [target, spec §6.14] |

## 6. Pay & review

| Step | Detail | Status |
|---|---|---|
| Pay | At completion: **UPI** (booking-specific QR / payment link) or **cash** to the technician | [live] |
| Receipt/status | Payment state visible on the booking | [live] |
| Review | Rate 1–5 + comment → feeds the technician's rating | [live] |

## 7. History (D4)

- `GET /me/bookings` list shows **two groups only**: **Booked** (anything in-flight: CONFIRMED → AWAITING_COMPLETION, incl. ESCALATED) and **Completed**.
- **No Cancelled tab. No cancelled or failed rows. Ever.** Including the customer's own window-cancels. [target — presentation filter, decision record §8.4]
- Server keeps everything (ops, finance, audit see all states).

## What the customer can never do

| Action | Why |
|---|---|
| Pick a time slot / reschedule | D1 — on-demand only |
| Cancel after 60 seconds | D2 — dispatch is committed; support is the path |
| Choose or decline a technician | D3 — assignment is automatic |
| See cancelled/failed history | D4 |
| See any OTP override | Doesn't exist — the dual-OTP guarantee is absolute (admin path is evidence-gated Manual Completion, disclosed + disputable) |
