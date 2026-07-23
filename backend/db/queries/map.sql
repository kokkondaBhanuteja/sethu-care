-- The live operations map (opsLiveMap). All reads; ops owns no aggregate. Positions come from
-- the technician last-known-location columns (migration 00014); job pins from bookings joined
-- to their address geography. There is NO zones table yet — the snapshot's zones are honestly
-- empty and every zoneId is the empty string (see internal/ops/livemap.go).

-- name: MapTechnicianPositions :many
-- Technicians with a position inside the freshness window. An older position is filtered out
-- entirely — a pin the platform cannot vouch for is worse than no pin. The lateral join finds
-- the booking the technician is actively working, which is what turns the marker busy.
SELECT
  t.user_id,
  u.name,
  t.last_lat::float8      AS lat,
  t.last_lng::float8      AS lng,
  t.last_location_at,
  t.is_online,
  -- COALESCEd to the nil uuid so the row scans without a pointer; uuid.Nil means "free".
  COALESCE(active.booking_id, '00000000-0000-0000-0000-000000000000'::uuid) AS active_booking_id
FROM technicians t
JOIN users u ON u.id = t.user_id
LEFT JOIN LATERAL (
  SELECT b.id AS booking_id
  FROM bookings b
  WHERE b.technician_id = t.user_id
    AND b.state IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'AWAITING_COMPLETION')
  ORDER BY b.updated_at DESC
  LIMIT 1
) active ON true
WHERE t.last_lat IS NOT NULL
  AND t.last_lng IS NOT NULL
  AND t.last_location_at >= @fresh_after::timestamptz
ORDER BY t.last_location_at DESC, t.user_id;

-- name: MapActiveJobs :many
-- Job pins: bookings a technician is travelling to or working (plus escalations, which the
-- map marks in their own colour). The pin sits on the booking's ADDRESS — the one position
-- the platform always knows.
SELECT
  b.id,
  b.state,
  ST_Y(a.geog::geometry)::float8 AS lat,
  ST_X(a.geog::geometry)::float8 AS lng,
  s.name AS service_name
FROM bookings b
JOIN addresses a      ON a.id = b.address_id
JOIN booking_items bi ON bi.booking_id = b.id
JOIN services s       ON s.id = bi.service_id
WHERE b.state IN ('EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'ESCALATED')
ORDER BY b.created_at, b.id;

-- name: MapAttentionItems :many
-- The map's attention rail: the same SEARCHING/ESCALATED membership as the dashboard queue,
-- with when the problem surfaced (entry into the current state).
SELECT
  b.id,
  b.state,
  COALESCE(
    (SELECT max(be.created_at) FROM booking_events be
      WHERE be.booking_id = b.id AND be.to_state = b.state),
    b.created_at
  )::timestamptz AS waiting_since
FROM bookings b
WHERE b.state IN ('SEARCHING', 'ESCALATED')
ORDER BY waiting_since, b.id;

-- name: MapCityTotals :one
-- The city-wide counters the snapshot carries alongside its markers: totals, not a count of
-- the markers in the response.
SELECT
  (SELECT count(*) FROM bookings
    WHERE state IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'AWAITING_COMPLETION'))::int AS active_jobs,
  (SELECT count(*) FROM technicians WHERE is_online AND NOT on_leave)::int AS online_providers;
