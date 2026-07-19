# Payments & Booking Concurrency — Design

How SETHU-CARE stays correct under stress: no double-booked technician, no duplicate booking, no
double charge, and clean back-pressure when a burst arrives. The guiding rule:

> **Redis for _flow_ (speed, idempotency, holds, rate limiting). Postgres for _truth_ (the invariants
> that must never break, even if Redis fails).**

Redis locks are advisory — they can be lost on failover, TTL expiry, or a GC pause. So Redis makes the
system _fast and smooth_, but the money and the schedule are guaranteed by Postgres constraints that
make the bad state physically impossible.

This builds on what the schema already does, it does not replace it:

- **`bookings.version`** is a compare-and-swap on every state change
  (`UPDATE … SET state=$1, version=version+1 WHERE id=$2 AND version=$3`). This already makes
  _same-booking_ races correct: two admins both `ASSIGN` the same SEARCHING booking, exactly one wins,
  the other gets 409. First-accept-wins for offer acceptance works the same way, in the database.
- **`state` has no CHECK** — the state machine is the sole authority on legal transitions.
- **`ledger_entries`** is append-only; **`payments`** capture is already idempotent
  (early-return if `CAPTURED`, plus an in-tx double-book-of-REVENUE guard).

## The four invariants

| # | Invariant | Enforced by (truth) | Helped by (flow) |
|---|---|---|---|
| 1 | One technician is never in two overlapping jobs | **Postgres EXCLUDE constraint** + `version` | Redis per-technician assign lock |
| 2 | A double-tapped "Book" creates one booking | Unique key on idempotency token | Redis idempotency-key cache |
| 3 | A payment is captured exactly once | Idempotent `CaptureUPIPayment` + `payment_gateway_events` unique | Redis (n/a — DB owns this) |
| 4 | Slot / capacity is not oversold | Reservation row / counter checked in-tx | Redis capacity counter + TTL hold |

### Why `version` is not enough for #1

`version` guards a _single row_. Double-booking a technician is a _cross-row_ race: booking A and
booking B are different rows with independent versions; each is legally `ASSIGN`'d to technician T at
overlapping times; both commit. The schedule is the invariant, and it lives across rows — so it needs a
constraint that spans rows:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
  ADD COLUMN duration_minutes INT NOT NULL DEFAULT 60 CHECK (duration_minutes > 0);

ALTER TABLE bookings ADD CONSTRAINT bookings_no_double_book
  EXCLUDE USING gist (
    technician_id WITH =,
    tstzrange(scheduled_for, scheduled_for + (duration_minutes || ' minutes')::interval) WITH &&
  ) WHERE (technician_id IS NOT NULL AND scheduled_for IS NOT NULL AND state <> 'CANCELLED');
```

Now a second overlapping `ASSIGN` **fails at commit** even if the Redis lock was lost. The assign path
catches the exclusion violation (SQLSTATE `23P01`) and returns 409 / re-dispatches. `duration_minutes`
is copied from the service variant's `estimated_minutes` at booking creation.

## Redis: the flow layer

- **Idempotency keys** — client sends `Idempotency-Key` per booking attempt; `SET idem:{key} <result> NX
  EX 600`. A retried/duplicated request returns the cached result instead of creating a second booking.
  Backed by a unique column so the guarantee survives a Redis flush.
- **Assignment lock** (redsync/Redlock) — `lock:tech:{id}:{yyyy-mm-dd}` held only across the
  read-schedule → assign critical section. Short TTL; released on commit. Cuts contention so the
  EXCLUDE constraint is the rare backstop, not the common path.
- **Reservation hold (TTL)** — when checkout starts, `SET hold:{tech}:{window} {booking} NX EX 300`
  holds the slot for 5 min while Razorpay runs, then auto-expires. No cron needed to free abandoned
  slots. Prevents "you lost your slot while paying".
- **Rate limit / back-pressure** — token bucket per user/IP (`INCR` + `EXPIRE`) and a global concurrency
  gate, so a burst is smoothed or shed with 429 instead of hammering Postgres.

Everything stays **synchronous** — creating a booking is one fast transaction and does not belong behind
a work queue. Only _side effects_ go async, via the existing **`outbox`**: notifications (SMS/push),
technician matching, webhooks. A full request queue is a flash-sale tool this app does not need yet.

## Payments under stress

Reuse the pharmacy's proven shape (see the research notes), adapted to our Go backend:

- **`payment_gateway_events`** — an idempotent webhook inbox: every raw event stored with
  `gateway_event_id UNIQUE`, `status RECEIVED|PROCESSED|FAILED`. The webhook dedupes on it, so gateway
  retries are no-ops, and it is the source for replay.
- **Parked-event replay** — if a webhook beats its payment row (a real race under load), leave the event
  `RECEIVED` and 200-ack; a sweep (folded into `outbox`) retries after ~5 min. Idempotent.
- **Idempotent capture** — already present; both the webhook and the (future) checkout callback funnel
  into the one `CaptureUPIPayment`, so whichever arrives second is harmless.

## The reserve → pay → confirm flow

1. `POST /bookings` with `Idempotency-Key` → Redis dedupe → create booking `PENDING` (DB), copying
   `duration_minutes` from the service.
2. Reserve the slot in Redis (`NX EX 300`) → open Razorpay.
3. `payment.captured` webhook (idempotent, via the event inbox) → **one Postgres tx**: capture payment +
   `ASSIGN` technician (EXCLUDE constraint enforces no overlap) + advance state.
4. Timeout / abandonment → Redis hold expires → an `outbox` sweep flips `PENDING` → `CANCELLED`; the slot
   is free again.

## Audit

Add an `audit_logs` table (`actor_user_id`, `actor_kind` user|system|gateway, `action`, `entity_type`,
`entity_id`, `before`, `after`, `correlation_id`, `created_at`) written **inside the same transaction**
as the change it records — so the audit row commits atomically with the mutation. Write points: payment
capture/failure, booking assign/state-change, refunds. The append-only `ledger_entries` already covers
_money_ movement; `audit_logs` adds the _who / before / after / why_ dimension.

## Build order (each a small, verifiable step)

1. **Migration**: `btree_gist` + `duration_minutes` + `bookings_no_double_book` EXCLUDE constraint.
   Handle SQLSTATE `23P01` in the assign path. _(Highest-value, aligns with existing `version` work.)_
2. **`payment_gateway_events`** inbox + dedupe/park logic in `razorpay_webhook.go`.
3. **Parked-event replay** sweep in `outbox`.
4. **`audit_logs`** + a tx-aware `audit.Record(ctx, tx, …)` at capture/assign/failure points.
5. **Redis wiring**: client + idempotency-key middleware, assignment lock, reservation hold, rate limit.
6. Load test the assign path (concurrent `ASSIGN` of one technician to overlapping bookings must yield
   exactly one success + one 409).
