# Admin (Ops) Workflows

**Persona:** the operations manager ("Ravi", spec §1.2) — usually on a phone, rescuing the rare booking automation couldn't place. · Rules in force: D1–D4 ([index](./README.md)). · Full screen specs: [`../Admin-Mobile-App.md`](../Admin-Mobile-App.md); deltas: [`../Booking-Workflow-Decisions.md`](../Booking-Workflow-Decisions.md) §7.

**The admin's role shifted under D3:** dispatch is automated, so the admin is no longer a dispatcher — they are an **exception handler**. Every admin touch on a booking is, by definition, something the automation or the OTP path could not resolve. Design consequence (spec's own principle): *"what needs me right now, and what can I do about it in under three taps?"*

---

## 1. Monitor (the default activity)

| Workflow | Detail | Status |
|---|---|---|
| Live dashboard | KPI tiles (bookings, revenue, completion, **avg auto-assign time** — now a health metric of the automation), needs-attention list, activity ticker | [target, spec §6.5; backend has ops queue + stats endpoints partially] |
| Needs-attention feed | Deterministic priority: unacked escalations → SLA breach → exhausted dispatch → at-risk → stalled | [target, spec §6.6] |
| Alerts + acknowledgement | Badge counts **unacknowledged critical only**; ack = ownership, broadcast to other admins | [target, spec §6.20] |
| Bookings list/detail | All states visible (admins DO see Cancelled/Failed — D4 hides them from customers only). **No "Scheduled" segment** (D1). Timeline shows auto-dispatch rounds ("Round 2 · radius +50% · 6 candidates") as the failure diagnostic | [live: `/bookings/{id}`, events; rounds-in-meta target §8.6] |
| Cash reconciliation | Per-technician collected / deposited / outstanding, oldest uncleared first | [live: `GET /ops/cash-reconciliation`] |
| Payments queue | Pending UPI collections; capture on PSP confirmation | [live: `GET /ops/payments`, `POST /payments/{ref}/capture` + Razorpay webhook inbox] |

## 2. Rescue a booking (the ONLY manual assignment — D3)

**Trigger:** auto-dispatch exhausted all rounds → `ESCALATED` → critical push (bypasses quiet hours).

```
push → unlock → booking detail (assign sheet pre-opened)
  → ranked candidates (distance-first; same ranking the automation used)
  → widen radius / relax skill (warned) — the human may override what the machine couldn't
  → ASSIGN (as admin) → booking proceeds normally → alert auto-resolves → audit entry
  → nothing viable? → emergency cancel + refund → FAILED/CANCELLED + goodwill credit
```

| Aspect | Detail | Status |
|---|---|---|
| Candidates + assign | `GET /ops/assignments` queue · `GET .../candidates` (PostGIS ranking) · assign via booking `ASSIGN` | [live] |
| Re-dispatch | Re-runs the **automation** with widened parameters (radius ×, relaxed skill, incentive) — the admin nudges the machine rather than hand-picking | [target reframe, spec §6.13] |
| Race safety | `version` CAS + EXCLUDE constraint: two admins (or admin vs automation) can't double-assign — loser gets 409 with the winner named | [live] |
| Never routine | No entry point to Assign outside an escalation. If manual assignments rise, the *automation* is what needs fixing | rule D3 |

## 3. Emergency cancel (post-window — D2)

Customer self-cancel ends at 60 s; after that, cancellation is an **admin-only, step-up-gated** exception (safety, fraud, unreachable customer, no supply):

- Required reason code + note → refund decision (policy-computed, overridable with justification) → **fresh biometric step-up** → confirm. 10 s undo. Full audit entry.
- Still impossible once `IN_PROGRESS` — a technician mid-job means ESCALATE, and a human decides the money. [mechanics live in state machine; step-up/reason flow target, spec §6.11]

## 4. Admin-Verified Manual Completion (the no-override rule)

There is **no OTP override**. When the Completion code truly cannot be obtained (≥30 min in `AWAITING_COMPLETION`):

1. Reason code → 2. **Evidence gate**: ≥1 provider work photo AND ≥1 logged call attempt → 3. Attestations + ≥20-char note → 4. Step-up biometric.
→ `Completed (Admin Verified)` — visibly distinct, customer notified with a **48 h dispute window**, provider payout-eligible, permanent audit entry. Tracked as its own metric (**target < 2% of completions**); 3+ per provider per week auto-flags. [target, spec §6.14/§1.6 — states beyond the current machine]

## 5. Money actions (mobile = support-driven only)

| Allowed on mobile | Never on mobile |
|---|---|
| Refund a booking (full/partial), goodwill credit, waive a fee — step-up + reason + provider-payout-impact disclosure; 10/hour rate limit as a fraud signal | Payout runs, settlements, reconciliation exports, ledger adjustments (desktop finance) |

[target, spec §6.27; ledger + credits live in backend, refund-to-gateway flow target]

## 6. Provider management

| Workflow | Detail | Status |
|---|---|---|
| Roster | Online / on-job / all; supply-health banner when a zone's online count drops below threshold | [target, spec §6.15; technician data live] |
| Profile & thresholds | 90-day metrics colour-coded (completion, **escalation rate** — replaces acceptance under direct assignment, rating, on-time) | [target, spec §6.16 adapted] |
| Force offline / suspend / block | Step-up + reason; **active jobs must be reassigned first** — never silently strand a customer; provider sees the reason | [target, spec §6.19] |
| Applications | Queue (oldest first, 48 h SLA) → review documents (auto-validation; "desktop recommended" when it fails) → approve / reject (step-up + reason) / request docs | [target, spec §6.17–6.18] |

## 7. Customers & support

Lookup (phone/name/booking) → profile with behavioural flags (high-cancel, repeat-refund, VIP) → tickets (safety always sorts first) → resolve / refund / credit / block (step-up). [target, spec §6.23–6.26]

## 8. Accountability (what makes all this power safe)

- **Every mutation audited** — immutable, append-only, before/after + reason + device + step-up flag; corrections are compensating actions, never edits. [live: `audit_logs` + `audit.Record` in the transition tx]
- **Step-up + reason codes** on every destructive/financial action (risk register: spec §10.3).
- **Single full-access role for v1** — accountability by audit, not restriction; the action registry keeps it RBAC-ready. [target, spec §10]
- **Trust-guard metrics** watched from day one: manual-completion rate, dispute rate on admin-verified, refund velocity per admin, suspension reversal rate. [target, spec §12.5]

## What the admin never does

| Action | Why |
|---|---|
| Routine assignment / dispatch | D3 — the machine dispatches; humans handle exceptions |
| Reschedule anything | D1 — the flow does not exist |
| Override an OTP | §4 — evidence-gated manual completion is the only path, and it is loud |
| Edit the audit log / execute payouts / export data from mobile | Hard platform constraints (spec §10.1) |
