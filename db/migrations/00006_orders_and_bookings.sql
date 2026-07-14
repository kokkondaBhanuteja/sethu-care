-- The spine (ROADMAP §4.3, §7, §9).
--
-- AN ORDER IS ONE CUSTOMER'S PURCHASE.  One payment.
-- A BOOKING IS ONE TECHNICIAN'S VISIT.  One state machine, one Start OTP, one Completion OTP.
--
-- These are different things, and conflating them was the original error. An AC service
-- and a geyser repair need different skills, so they are two technicians, two arrivals and
-- two OTP pairs — and no single state machine can honestly describe "half arrived".
--
-- Why this could not wait for P3: AUDIT. One ₹1,399 payment fanning out to two bookings,
-- with no parent entity, must either invent an allocation across them or staple the whole
-- amount to one and show the other as ₹0. Both are LIES in an append-only ledger — and §6
-- exists precisely so the ledger never lies. You can add a table later; you cannot go back
-- and re-attach ledger rows that were written against the wrong entity.
--
-- Per §4.6 this is a SEAM, not a feature: in P0/P1 an order has exactly one booking and a
-- booking exactly one item. The unique indexes below enforce that, and P3 relaxes them.

-- +goose Up

CREATE TABLE orders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,

    status      TEXT   NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'PAID', 'REFUNDED', 'CANCELLED')),
    total_paise BIGINT NOT NULL DEFAULT 0 CHECK (total_paise >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version    BIGINT      NOT NULL DEFAULT 0
);

CREATE INDEX orders_customer_idx ON orders (customer_id, created_at DESC);

CREATE TABLE bookings (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,

    customer_id     UUID NOT NULL REFERENCES users (id)              ON DELETE RESTRICT,
    address_id      UUID NOT NULL REFERENCES addresses (id)          ON DELETE RESTRICT,
    technician_id   UUID          REFERENCES technicians (user_id)   ON DELETE RESTRICT, -- null until assigned
    product_unit_id UUID          REFERENCES product_units (id)      ON DELETE RESTRICT, -- set when servicing OUR appliance

    -- DELIBERATELY NO CHECK CONSTRAINT — the ONLY enum column in the schema without one.
    --
    -- The state machine is the sole authority on what a booking's state may be, and it
    -- enforces far more than a CHECK ever could: not merely "is this a real state" but
    -- "is this a LEGAL state to arrive at, from where you were, by the action you took".
    -- A CHECK here would be a second, dumber authority saying less, and the two would
    -- drift. Go's ParseState() guards the read path. See ROADMAP §7a.
    state TEXT NOT NULL DEFAULT 'DRAFT',

    scheduled_for      TIMESTAMPTZ,
    quoted_total_paise BIGINT NOT NULL DEFAULT 0 CHECK (quoted_total_paise >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- THE CONCURRENCY GUARD (ROADMAP §9).
    --
    -- The state machine proves a transition is LEGAL. It says nothing about two people
    -- applying a legal transition at the same instant: two admins working the P1 manual
    -- queue both read SEARCHING, both find ASSIGN perfectly legal, and both write. Last
    -- write wins — TWO TECHNICIANS SENT TO ONE ADDRESS, with every rule satisfied.
    --
    -- So every state change is a compare-and-swap:
    --     UPDATE bookings SET state=$1, version=version+1 WHERE id=$2 AND version=$3
    -- Zero rows affected means somebody else moved first, and the caller gets a 409.
    --
    -- This is also what makes P2's first-accept-wins correct WITHOUT a Redis lock: two
    -- technicians accepting the same offer race the same SEARCHING → ASSIGNED update, and
    -- exactly one wins — in the database.
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX bookings_state_idx      ON bookings (state, created_at DESC);
CREATE INDEX bookings_order_idx      ON bookings (order_id);
CREATE INDEX bookings_customer_idx   ON bookings (customer_id, created_at DESC);
CREATE INDEX bookings_technician_idx ON bookings (technician_id) WHERE technician_id IS NOT NULL;

-- P0/P1 INVARIANT — one visit per purchase. DROP THIS INDEX IN P3 to allow an order to
-- fan out into several technician visits. The structure is already correct; only this
-- restriction is temporary.
CREATE UNIQUE INDEX bookings_one_per_order_idx ON bookings (order_id);

CREATE TABLE booking_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings (id)         ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services (id)         ON DELETE RESTRICT,
    variant_id UUID NOT NULL REFERENCES service_variants (id) ON DELETE RESTRICT,

    quantity         INT    NOT NULL DEFAULT 1 CHECK (quantity > 0),
    line_total_paise BIGINT NOT NULL DEFAULT 0 CHECK (line_total_paise >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version    BIGINT      NOT NULL DEFAULT 0
);

-- P0/P1 INVARIANT — one item per visit, so dispatch has exactly one required skill set and
-- one duration to reason about. DROP IN P3, when one technician may perform several
-- services in a single visit ("AC service + gas refill").
CREATE UNIQUE INDEX booking_items_one_per_booking_idx ON booking_items (booking_id);

-- APPEND-ONLY. Every transition writes exactly one row, in the SAME TRANSACTION as the
-- booking update (ROADMAP §7). This log is our debugger, our dispute evidence when a
-- customer and a technician disagree about what happened in their kitchen, and P5's
-- analytics source.
--
-- No `version`. No `updated_at`. Those columns would advertise a mutation that must never
-- happen — and the trigger below makes sure it cannot.
CREATE TABLE booking_events (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings (id) ON DELETE RESTRICT,

    from_state TEXT NOT NULL,
    action     TEXT NOT NULL,
    to_state   TEXT NOT NULL,

    -- Who did this. Null for transitions the system made on its own (an expiry, a timeout).
    actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,

    meta       JSONB       NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX booking_events_booking_idx ON booking_events (booking_id, created_at);

CREATE TRIGGER booking_events_are_append_only
    BEFORE UPDATE OR DELETE ON booking_events
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- +goose Down
DROP TABLE IF EXISTS booking_events;
DROP TABLE IF EXISTS booking_items;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS orders;
