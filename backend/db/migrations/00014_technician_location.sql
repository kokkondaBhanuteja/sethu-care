-- The technician's last-known location, updated as they travel to a job, so the customer can watch
-- them approach on the live map. Nullable — populated only once a technician starts sharing while
-- en route; cleared conceptually by staleness (the reader checks last_location_at).

-- +goose Up
ALTER TABLE technicians
    ADD COLUMN last_lat         DOUBLE PRECISION,
    ADD COLUMN last_lng         DOUBLE PRECISION,
    ADD COLUMN last_location_at TIMESTAMPTZ;

-- +goose Down
ALTER TABLE technicians
    DROP COLUMN last_lat,
    DROP COLUMN last_lng,
    DROP COLUMN last_location_at;
