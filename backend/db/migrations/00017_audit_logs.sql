-- The business audit trail (see docs/payments-booking-concurrency.md, step 4).
--
-- ledger_entries is append-only and already tells the full story of MONEY. audit_logs adds the
-- other dimension: WHO did WHAT to WHICH entity, and the before/after of the change — for bookings
-- state transitions, payment capture, and the like. Every row is written INSIDE the same
-- transaction as the mutation it records (audit.Record takes the caller's tx), so the log can never
-- disagree with what actually happened: either both commit or neither does.
--
-- actor_kind distinguishes a human (`user`, with actor_user_id set), a background job (`system`,
-- e.g. the outbox auto-search), and a payment gateway (`gateway`, webhook-driven). correlation_id
-- groups the several rows a single logical action may write.

-- +goose Up
CREATE TABLE audit_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id  UUID REFERENCES users (id) ON DELETE RESTRICT,   -- null for system / gateway actors
    actor_kind     TEXT NOT NULL DEFAULT 'user'
                     CHECK (actor_kind IN ('user', 'system', 'gateway')),
    action         TEXT  NOT NULL,   -- 'ASSIGN', 'CONFIRM', 'PAYMENT_CAPTURED', ...
    entity_type    TEXT  NOT NULL,   -- 'booking', 'payment', ...
    entity_id      UUID  NOT NULL,
    before         JSONB,
    after          JSONB,
    correlation_id UUID,
    ip_address     TEXT,
    user_agent     TEXT,
    metadata       JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX audit_logs_actor_idx  ON audit_logs (actor_user_id, created_at DESC)
    WHERE actor_user_id IS NOT NULL;

-- +goose Down
DROP TABLE audit_logs;
