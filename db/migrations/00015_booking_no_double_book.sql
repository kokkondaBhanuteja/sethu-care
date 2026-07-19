-- The cross-booking concurrency guard (see docs/payments-booking-concurrency.md).
--
-- bookings.version already makes SAME-booking races correct: two admins both ASSIGN one SEARCHING
-- booking, exactly one wins the compare-and-swap. But version guards a single ROW. Double-booking a
-- technician is a CROSS-row race: booking A and booking B are different rows with independent
-- versions, each legally ASSIGN'd to technician T at overlapping times — both commit, and the same
-- technician is committed to one window twice.
--
-- The invariant "a technician holds at most one job per time window" spans rows, so it needs a
-- constraint that spans rows: a GiST EXCLUDE over the assigned time range. A second overlapping
-- assignment now FAILS at commit (SQLSTATE 23P01) even if a Redis assign-lock was lost under stress.
--
-- Postgres marks `timestamptz + interval` STABLE (DST depends on the session zone), so it can't sit
-- in an index expression. We therefore materialise scheduled_end via a BEFORE trigger (duration is
-- the human input; scheduled_end is derived and kept consistent by the DB) and range over two plain
-- timestamptz columns, which IS immutable. Terminal states that RELEASE the slot (CANCELLED, FAILED =
-- nobody found, RESCHEDULED = moved elsewhere) are excluded from the constraint.

-- +goose Up
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
    ADD COLUMN duration_minutes INT NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
    ADD COLUMN scheduled_end    TIMESTAMPTZ;

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION bookings_set_scheduled_end() RETURNS trigger AS $$
BEGIN
    IF NEW.scheduled_for IS NULL THEN
        NEW.scheduled_end := NULL;
    ELSE
        NEW.scheduled_end := NEW.scheduled_for + make_interval(mins => NEW.duration_minutes);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

CREATE TRIGGER bookings_scheduled_end_biu
    BEFORE INSERT OR UPDATE OF scheduled_for, duration_minutes ON bookings
    FOR EACH ROW EXECUTE FUNCTION bookings_set_scheduled_end();

ALTER TABLE bookings ADD CONSTRAINT bookings_no_double_book
    EXCLUDE USING gist (
        technician_id WITH =,
        tstzrange(scheduled_for, scheduled_end) WITH &&
    ) WHERE (
        technician_id IS NOT NULL
        AND scheduled_for IS NOT NULL
        AND state NOT IN ('CANCELLED', 'FAILED', 'RESCHEDULED')
    );

-- +goose Down
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_double_book;
DROP TRIGGER IF EXISTS bookings_scheduled_end_biu ON bookings;
DROP FUNCTION IF EXISTS bookings_set_scheduled_end();
ALTER TABLE bookings DROP COLUMN IF EXISTS scheduled_end;
ALTER TABLE bookings DROP COLUMN IF EXISTS duration_minutes;
-- btree_gist is left installed on purpose — dropping an extension other objects may use is unsafe.
