-- The money (ROADMAP §6).
--
-- Customers pay the COMPANY. Technicians are SALARIED. Money never flows
-- company → technician per job. There is no commission, no payout, no settlement.
--
-- ONE append-only table, not the four (payments / cash_custody / credits / ledger) the
-- first draft imagined. Four tables each need their own reconciliation query and can drift
-- apart from one another. One append-only log with a `kind` column cannot.

-- +goose Up

CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    kind TEXT NOT NULL CHECK (kind IN (
        'REVENUE',        -- the customer paid us
        'CASH_CUSTODY',   -- a technician is holding OUR cash — a debt to us
        'CASH_DEPOSIT',   -- they handed it in; offsets the custody
        'CREDIT_ISSUED',  -- we owe the customer (refund / apology)
        'CREDIT_REDEEMED'
    )),

    -- MAY BE NEGATIVE, deliberately. The ledger is append-only: you never edit a row to
    -- fix a mistake, you write a new one that offsets it. That is the whole discipline,
    -- and it is why money.Money allows negatives while quoted totals guard against them.
    amount_paise BIGINT NOT NULL,

    -- WHERE MONEY ATTACHES — this is the Order/Booking split made enforceable.
    --
    --   order_id   → REVENUE, CREDIT_ISSUED, CREDIT_REDEEMED.
    --                Money is PURCHASED once, for the whole order.
    --   booking_id → CASH_CUSTODY, CASH_DEPOSIT.
    --                Cash is COLLECTED at a specific visit, by a specific technician.
    --
    -- The CHECK below makes it impossible to record revenue against a booking, or cash
    -- custody with no technician to hold it accountable. Without it, a single payment
    -- spanning two bookings would have to be split by an invented allocation — a lie in a
    -- table that can never be corrected, only offset.
    order_id      UUID REFERENCES orders (id)            ON DELETE RESTRICT,
    booking_id    UUID REFERENCES bookings (id)          ON DELETE RESTRICT,
    customer_id   UUID REFERENCES users (id)             ON DELETE RESTRICT,
    technician_id UUID REFERENCES technicians (user_id)  ON DELETE RESTRICT,

    method TEXT CHECK (method IN ('UPI', 'CASH', 'ONLINE')),
    memo   TEXT NOT NULL DEFAULT '',

    -- The offsetting row points at the row it corrects. This is what makes a correction
    -- auditable rather than merely a second number that happens to cancel the first.
    reverses_entry_id UUID REFERENCES ledger_entries (id) ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ledger_entries_money_attaches_at_the_right_level CHECK (
        (kind IN ('REVENUE', 'CREDIT_ISSUED', 'CREDIT_REDEEMED') AND order_id IS NOT NULL)
        OR
        (kind IN ('CASH_CUSTODY', 'CASH_DEPOSIT') AND booking_id IS NOT NULL AND technician_id IS NOT NULL)
    ),

    -- Cash is cash. A CASH_CUSTODY entry paid by UPI is a contradiction: with UPI the
    -- money lands directly in the company account and the technician never touches it,
    -- so there is nothing to be in custody OF.
    CONSTRAINT ledger_entries_cash_kinds_are_cash CHECK (
        kind NOT IN ('CASH_CUSTODY', 'CASH_DEPOSIT') OR method = 'CASH'
    )
);

-- THE APPEND-ONLY GUARANTEE, ENFORCED BY THE DATABASE.
-- ROADMAP §6 says "never mutate a row; correct with an offsetting entry." A comment cannot
-- stop an UPDATE. This can. It avoids the classic startup catastrophe of a `balance` column
-- that drifts from truth and can never be reconciled.
CREATE TRIGGER ledger_entries_are_append_only
    BEFORE UPDATE OR DELETE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Drives the admin cash reconciliation screen (P1).
CREATE INDEX ledger_entries_technician_idx ON ledger_entries (technician_id, kind)
    WHERE technician_id IS NOT NULL;
CREATE INDEX ledger_entries_order_idx ON ledger_entries (order_id) WHERE order_id IS NOT NULL;

-- THE CROSS-CHECK (ROADMAP §6). For each technician: collected · deposited · outstanding.
-- Without this the gap is invisible, and cash-in-pocket becomes shrinkage you cannot prove.
-- A VIEW, not a table — it is derived from the log and therefore cannot drift from it.
CREATE VIEW technician_cash_position AS
SELECT
    technician_id,
    COALESCE(SUM(amount_paise) FILTER (WHERE kind = 'CASH_CUSTODY'), 0) AS collected_paise,
    COALESCE(SUM(amount_paise) FILTER (WHERE kind = 'CASH_DEPOSIT'), 0) AS deposited_paise,
    COALESCE(SUM(amount_paise) FILTER (WHERE kind = 'CASH_CUSTODY'), 0)
        - COALESCE(SUM(amount_paise) FILTER (WHERE kind = 'CASH_DEPOSIT'), 0) AS outstanding_paise,
    MIN(created_at) FILTER (WHERE kind = 'CASH_CUSTODY') AS oldest_collection_at
FROM ledger_entries
WHERE technician_id IS NOT NULL
GROUP BY technician_id;

-- +goose Down
DROP VIEW IF EXISTS technician_cash_position;
DROP TABLE IF EXISTS ledger_entries;
