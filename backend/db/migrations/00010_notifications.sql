-- The record of every notification the system sent. Append-only: what we told a customer is
-- history, and history is not edited.

-- +goose Up
CREATE TABLE notification_log (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    channel      TEXT NOT NULL CHECK (channel IN ('SMS', 'PUSH')),
    event_type   TEXT NOT NULL,
    booking_id   UUID REFERENCES bookings (id) ON DELETE SET NULL,
    body         TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notification_log_recipient_idx ON notification_log (recipient_id, created_at DESC);

-- Idempotency support for the at-least-once consumer: one notification per (booking, event).
-- A redelivered event finds this row and does not send a duplicate.
CREATE UNIQUE INDEX notification_log_once_per_booking_event_idx
    ON notification_log (booking_id, event_type)
    WHERE booking_id IS NOT NULL;

CREATE TRIGGER notification_log_is_append_only
    BEFORE UPDATE OR DELETE ON notification_log
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- +goose Down
DROP TABLE IF EXISTS notification_log;
