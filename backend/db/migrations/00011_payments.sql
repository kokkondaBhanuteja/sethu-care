-- A UPI collection for a booking. The company shows a booking-specific UPI QR (ROADMAP §10);
-- the customer scans and pays into the COMPANY account — the technician never touches the
-- money. REVENUE is only booked when the payment is CAPTURED, not assumed at completion: until
-- the money actually lands, it is not the company's.
--
-- This table is mutable (PENDING -> CAPTURED), unlike the append-only ledger. The ledger is the
-- record of money that HAS moved; this is the record of money we are WAITING on.

-- +goose Up
CREATE TABLE payments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- One collection per booking: a booking is completed once, for one quoted total. The UNIQUE
    -- is what makes "create the collection" idempotent under at-least-once event delivery.
    booking_id   UUID NOT NULL UNIQUE REFERENCES bookings (id) ON DELETE RESTRICT,
    order_id     UUID NOT NULL        REFERENCES orders (id)   ON DELETE RESTRICT,

    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),

    -- Our transaction reference (the UPI `tr` field), unique so a capture callback maps to
    -- exactly one collection.
    reference    TEXT NOT NULL UNIQUE,

    status       TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CAPTURED')),

    -- The PSP's own transaction id (UPI RRN), recorded on capture for reconciliation. Null while
    -- pending.
    provider_ref TEXT,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    captured_at  TIMESTAMPTZ,

    -- A captured payment has a capture time, and a pending one does not — the two states cannot
    -- disagree with the timestamp.
    CONSTRAINT payments_captured_iff_timestamp CHECK (
        (status = 'CAPTURED') = (captured_at IS NOT NULL)
    )
);

-- +goose Down
DROP TABLE payments;
