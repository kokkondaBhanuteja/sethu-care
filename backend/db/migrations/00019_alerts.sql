-- The admin console's alert model (Admin spec §6.20/§6.21, §8 escalation engine).
--
-- An alert is a PERSISTED row, not a projection: acknowledgement is ownership state that must
-- survive restarts, replays and two admins racing. Rows are produced by the alert engine — an
-- outbox consumer that reacts to domain events (today: booking.escalated → one CRITICAL alert).
-- Delivery is at-least-once, so creation is idempotent twice over:
--   * source_event_id UNIQUE — the same outbox event redelivered can never insert twice;
--   * alerts_one_open_per_subject_idx — one OPEN (unacknowledged) alert per (kind, subject),
--     so a subject that fires again while an operator already owns the page does not fan out.
--
-- ID SCHEME. alerts.id is the alert's own key. The phase-1 attention queue advertised
-- alertId = booking id before this table existed, so the read path also resolves a SUBJECT id
-- (the booking's uuid) to that subject's newest alert — see internal/alert.Service.
--
-- kind/severity/subject_kind are TEXT + CHECK, pinned to internal/alert's Go constants by
-- internal/schema/drift_test.go. Only BOOKING_ESCALATED is produced today; the rest of the
-- vocabulary is declared so the contract's closed set and the storage agree from day one.

-- +goose Up
CREATE TABLE alerts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    kind         TEXT NOT NULL CHECK (kind IN (
        'BOOKING_ESCALATED', 'ASSIGNMENT_FAILED', 'SLA_AT_RISK', 'SLA_BREACHED',
        'NEW_APPLICATION', 'PROVIDER_AUTO_SUSPENDED', 'LOW_RATING', 'PAYMENT_FAILED',
        'DAILY_SUMMARY')),
    severity     TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFORMATIONAL')),

    -- The record the alert is about. Null for subjectless kinds (a daily summary).
    subject_kind TEXT CHECK (subject_kind IN ('BOOKING', 'PROVIDER')),
    subject_id   UUID,

    -- The outbox event that produced this row — the engine's idempotency anchor. Null for
    -- rows not born from an event (the dev seed).
    source_event_id UUID UNIQUE,

    -- Only the CRITICAL tier claims ownership (§6.20); everything else is a notification.
    requires_acknowledgement BOOLEAN NOT NULL DEFAULT false,
    acknowledged_by UUID REFERENCES users (id) ON DELETE RESTRICT,
    acknowledged_at TIMESTAMPTZ,

    -- The informational tier's read marker (POST /ops/alerts/read-all). Never set on a row
    -- that requires acknowledgement — read-all must not silence a critical.
    read_at    TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT alerts_subject_pair_chk CHECK ((subject_kind IS NULL) = (subject_id IS NULL)),
    CONSTRAINT alerts_ack_pair_chk     CHECK ((acknowledged_by IS NULL) = (acknowledged_at IS NULL))
);

-- One OPEN alert per (kind, subject): re-firing while unacknowledged is a no-op; after an
-- acknowledgement the same subject may legitimately alert again.
CREATE UNIQUE INDEX alerts_one_open_per_subject_idx
    ON alerts (kind, subject_id)
    WHERE acknowledged_at IS NULL AND subject_id IS NOT NULL;

CREATE INDEX alerts_feed_idx ON alerts (created_at DESC, id DESC);
CREATE INDEX alerts_needs_action_idx ON alerts (created_at DESC)
    WHERE requires_acknowledgement AND acknowledged_at IS NULL;
CREATE INDEX alerts_subject_idx ON alerts (subject_id, created_at DESC)
    WHERE subject_id IS NOT NULL;

-- The handover record between admins on one alert. Replay-safe: the operator's
-- Idempotency-Key is stored, and a retried request lands on the unique index instead of
-- writing a second note.
CREATE TABLE alert_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id        UUID NOT NULL REFERENCES alerts (id) ON DELETE RESTRICT,
    author_user_id  UUID NOT NULL REFERENCES users (id)  ON DELETE RESTRICT,
    idempotency_key TEXT NOT NULL,
    body            TEXT NOT NULL CHECK (length(body) > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX alert_notes_idempotency_idx
    ON alert_notes (alert_id, author_user_id, idempotency_key);
CREATE INDEX alert_notes_alert_idx ON alert_notes (alert_id, created_at);

-- +goose Down
DROP TABLE alert_notes;
DROP TABLE alerts;
