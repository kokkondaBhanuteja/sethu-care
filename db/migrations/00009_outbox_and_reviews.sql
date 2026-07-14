-- The transactional outbox, and reviews.

-- +goose Up

-- THE TRANSACTIONAL OUTBOX (ROADMAP §8).
--
-- Spring Modulith gave us this for free as `event_publication`. In Go we build it, and it
-- is worth understanding exactly what it buys.
--
-- The naive alternative is to publish an event by calling the listener. But consider:
-- BookingService commits "booking completed", then calls Ledger to bill it — and the
-- process is killed in between (a deploy, an OOM, a network partition). The booking is
-- COMPLETED and nobody was ever billed. The job was done for free and no error was ever
-- raised, because nothing failed; the process simply stopped existing.
--
-- The outbox closes that window. The event row is INSERTed in the SAME TRANSACTION as the
-- state change, so either both land or neither does. A separate worker then reads
-- unpublished rows and dispatches them. A crash means the row is still there, unpublished,
-- and it goes out on restart.
--
-- Consequence: delivery is AT-LEAST-ONCE, never exactly-once. A crash after dispatch but
-- before marking published will send the event twice. **Every consumer must therefore be
-- idempotent.** That is not a flaw to be fixed; it is the contract.
--
-- NOT append-only: `published_at` and `attempts` are written by the worker after the fact,
-- so this table gets no forbid_mutation trigger. It is the one exception, and it is why it
-- carries `updated_at` where booking_events and ledger_entries do not.
CREATE TABLE outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    aggregate_type TEXT NOT NULL,  -- 'booking', 'order', 'offer'
    aggregate_id   UUID NOT NULL,
    event_type     TEXT NOT NULL,  -- 'booking.completed' — the §8 catalog
    payload        JSONB NOT NULL,

    published_at TIMESTAMPTZ,
    attempts     INT  NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    last_error   TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The worker's only query: "what has not gone out yet?", oldest first. A partial index, so
-- it stays small and fast no matter how many millions of events have already been
-- published — the published rows are simply not in it.
CREATE INDEX outbox_unpublished_idx ON outbox (created_at)
    WHERE published_at IS NULL;

CREATE INDEX outbox_aggregate_idx ON outbox (aggregate_type, aggregate_id);

CREATE TABLE reviews (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- One review per booking. A customer does not get to rate the same job twice.
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings (id)        ON DELETE RESTRICT,
    customer_id   UUID NOT NULL     REFERENCES users (id)           ON DELETE RESTRICT,
    technician_id UUID NOT NULL     REFERENCES technicians (user_id) ON DELETE RESTRICT,

    rating  INT  NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL DEFAULT '',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version    BIGINT      NOT NULL DEFAULT 0
);

CREATE INDEX reviews_technician_idx ON reviews (technician_id, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS outbox;
