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
-- Deliberately a NO-OP.
--
-- `DROP EXTENSION postgis` fails anyway — PostGIS's own spatial_ref_sys table depends on
-- it — and `CASCADE` would "fix" that by dropping spatial_ref_sys too, which is the 8,500
-- coordinate systems every geography column on this database is defined against.
--
-- Rolling back a schema change should never uninstall the database's capabilities. There
-- is no scenario where undoing a migration means "and also remove geospatial support".
SELECT 1;
