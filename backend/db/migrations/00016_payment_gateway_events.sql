-- The idempotent gateway-webhook inbox (see docs/payments-booking-concurrency.md, step 2).
--
-- Today the Razorpay webhook verifies the signature, captures, and DISCARDS the event. That loses
-- two things: a dedupe record (a gateway retry re-runs capture — safe today, but only by luck of
-- CaptureUPIPayment being idempotent) and a durable log to replay from when a webhook beats its
-- payment row under load. This table is the inbox: every delivered event is stored once, keyed by
-- the provider's own event id, and marked PROCESSED only after it has been applied.
--
--   RECEIVED  -> stored, not yet applied (or "parked": the payment row wasn't visible yet)
--   PROCESSED -> applied; a duplicate delivery short-circuits here
--   FAILED    -> permanent failure kept for inspection
--
-- gateway_event_id UNIQUE is the dedupe key (Razorpay's X-Razorpay-Event-Id). The (status,
-- created_at) index feeds the parked-event replay sweep (step 3).

-- +goose Up
CREATE TABLE payment_gateway_events (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider         TEXT NOT NULL DEFAULT 'razorpay',
    event_type       TEXT NOT NULL,
    gateway_event_id TEXT NOT NULL UNIQUE,
    reference        TEXT NOT NULL DEFAULT '',   -- our payment reference (payments.reference), when known
    provider_ref     TEXT NOT NULL DEFAULT '',   -- the provider's payment entity id
    payload          JSONB NOT NULL,             -- the raw verified body, for replay
    status           TEXT NOT NULL DEFAULT 'RECEIVED'
                       CHECK (status IN ('RECEIVED', 'PROCESSED', 'FAILED')),
    processed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payment_gateway_events_status_idx ON payment_gateway_events (status, created_at);

-- +goose Down
DROP TABLE payment_gateway_events;
