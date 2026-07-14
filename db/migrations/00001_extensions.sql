-- MIGRATION RULE, stated once so it is never ambiguous:
--
--   Applied migrations are IMMUTABLE. Once a file has run against any database,
--   never edit it. goose records a hash; a changed file means the schema in your
--   head and the schema on disk have silently diverged. A new change is a NEW file.
--
-- goose replaces Flyway from the Java build. Same discipline, different tool.

-- +goose Up
-- ROADMAP §9: addresses and (from P2) technician_locations are geography points.
-- The nearby-technician query is a single indexed ST_DWithin.
CREATE EXTENSION IF NOT EXISTS postgis;

-- +goose Down
DROP EXTENSION IF EXISTS postgis;
