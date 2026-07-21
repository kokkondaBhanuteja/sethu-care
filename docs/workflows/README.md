# SETHU-CARE — Workflows by Persona

**Workflow documentation index v1.0** · Decision authority: [`../Booking-Workflow-Decisions.md`](../Booking-Workflow-Decisions.md)

The product's workflows, divided by who performs them:

| Doc | Persona | Owns |
|---|---|---|
| [`customer-workflow.md`](./customer-workflow.md) | **Customer** | Book → track → verify (dual-OTP) → pay → review · the 60-second cancel window · history (Booked + Completed only) |
| [`provider-workflow.md`](./provider-workflow.md) | **Provider (technician)** | Availability → receive auto-assigned job → travel → dual-OTP start/complete → work photos → collect payment → cash deposit |
| [`admin-workflow.md`](./admin-workflow.md) | **Admin (ops)** | Monitor → escalation rescue (the ONLY manual assignment) → emergency cancel → admin-verified completion → refunds → roster/applications → cash & payments → audit |

---

## The four product rules (apply across every persona)

| # | Rule |
|---|---|
| D1 | **On-demand booking only** — no slot selection, no reschedule, anywhere. |
| D2 | **Customer cancellation only within 60 seconds** of booking; after that, no customer cancel (dispatch is done). |
| D3 | **Provider assignment is fully automated and location-based** — distance-ranked, auto-widening rounds. Admins assign only as escalation rescue. |
| D4 | **Customers see only Booked + Completed jobs** — cancelled/failed bookings never appear in their history (kept server-side for ops/audit). |

## The shared lifecycle (one booking, three personas)

```
CUSTOMER            SYSTEM (auto)                PROVIDER                    ADMIN
--------            -------------                --------                    -----
book (on-demand)
   │ CONFIRMED
   │ 60s cancel ──► dispatch rounds 1–3
   │ window         (distance-ranked,
   ▼                 auto-widening)
                        │ found ──────────────► job lands: ASSIGNED
                        │                         DEPART → EN_ROUTE
                        │ exhausted ─────────────────────────────────────► ESCALATED: rescue-assign
                                                  ARRIVE → ARRIVED           (or emergency cancel)
share Start OTP ◄───────────────────────────── ask for start code
                                                  IN_PROGRESS (work + photos)
                                                  REQUEST_COMPLETION
share Completion OTP ◄───────────────────────── ask for completion code
                                                  COMPLETED
pay (UPI QR / cash) ─────────────────────────► collect                     capture / reconcile
review · history: "Completed"                    payout-eligible · cash deposit   audit trail
```

Backend state machine (unchanged, `internal/booking/statemachine.go`):
`DRAFT → CONFIRMED → SEARCHING → ASSIGNED → EN_ROUTE → ARRIVED → IN_PROGRESS → AWAITING_COMPLETION → COMPLETED`, with `ESCALATED / CANCELLED / FAILED` branches (`RESCHEDULED` exists but is unused by product flows — D1).

## Conventions used in the persona docs

- **[live]** — works against the current Go backend today (endpoint/state named).
- **[target]** — specified behaviour (from `Admin-Mobile-App.md` or the decision record) not yet built; the backend impact map in the decision record §8 tracks the gap.
- States/actions in `CAPS` are the backend's (`internal/booking/state.go`); screens cited as "spec §x.y" refer to `../Admin-Mobile-App.md`.
