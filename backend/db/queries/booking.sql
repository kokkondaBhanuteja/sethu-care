-- name: GetBookingState :one
-- The read half of a transition. state is TEXT (no CHECK — the state machine is its
-- sole authority, ROADMAP §7a); Go's ParseState guards it on the way in.
SELECT state, version
  FROM bookings
 WHERE id = $1;

-- name: ApplyBookingTransition :execrows
-- THE COMPARE-AND-SWAP. This is the whole concurrency guarantee in one statement.
-- version in the WHERE clause is what makes two admins racing the same ASSIGN safe:
-- the second one matches zero rows, and :execrows returns 0, which the service turns
-- into a conflict (409). Never a lost update, never two technicians at one address.
UPDATE bookings
   SET state         = @to_state,
       -- A booking that is searching or escalated has no technician by definition — undoing an
       -- assign (ESCALATE) or re-running the search must not leave a ghost assignment behind.
       technician_id = CASE
                         WHEN @to_state IN ('SEARCHING', 'ESCALATED')
                           THEN NULL
                         ELSE COALESCE(sqlc.narg('technician_id'), technician_id)
                       END,
       version       = version + 1,
       updated_at    = now()
 WHERE id = @id AND version = @expected_version;

-- name: InsertBookingEvent :exec
-- APPEND-ONLY. Written in the SAME transaction as the transition, so the log can never
-- disagree with the booking's current state.
INSERT INTO booking_events (booking_id, from_state, action, to_state, actor_user_id, meta)
VALUES (@booking_id, @from_state, @action, @to_state, sqlc.narg('actor_user_id'), @meta);

-- name: CreateOrder :one
INSERT INTO orders (customer_id, total_paise)
VALUES (@customer_id, @total_paise)
RETURNING id;

-- name: CreateBooking :one
-- duration_minutes seeds the technician's assigned window for the no-double-book EXCLUDE
-- constraint; it is copied from the service's estimated_minutes at creation.
INSERT INTO bookings (order_id, customer_id, address_id, quoted_total_paise, duration_minutes)
VALUES (@order_id, @customer_id, @address_id, @quoted_total_paise, @duration_minutes)
RETURNING id, state, version;

-- name: CreateBookingItem :exec
INSERT INTO booking_items (booking_id, service_id, variant_id, quantity, line_total_paise)
VALUES (@booking_id, @service_id, @variant_id, @quantity, @line_total_paise);

-- name: GetServiceVariant :one
-- Used at creation time: the price comes from the variant (never from the client), and
-- service_id is derived from it so the booking_item can never reference a variant that
-- belongs to a different service. estimated_minutes (from the parent service) seeds the
-- booking's duration for the schedule guard.
SELECT v.id, v.service_id, v.base_price_paise, v.is_active, s.estimated_minutes
  FROM service_variants v
  JOIN services s ON s.id = v.service_id
 WHERE v.id = $1;

-- name: GetBooking :one
SELECT id, order_id, customer_id, address_id, technician_id, state, quoted_total_paise, version
  FROM bookings
 WHERE id = $1;

-- name: ListCustomerBookings :many
-- A customer's own bookings, newest first — their history across every state.
SELECT
  b.id, b.state, b.scheduled_for, b.quoted_total_paise, b.created_at,
  s.name AS service_name,
  a.city
FROM bookings b
JOIN booking_items bi ON bi.booking_id = b.id
JOIN services s       ON s.id = bi.service_id
JOIN addresses a      ON a.id = b.address_id
WHERE b.customer_id = $1
ORDER BY b.created_at DESC;

-- name: ListTechnicianJobs :many
-- A technician's active jobs, with the customer contact and address they need on site.
-- Active = anything from ASSIGNED through AWAITING_COMPLETION; finished/cancelled jobs drop
-- off the list. Soonest scheduled first.
SELECT
  b.id, b.state, b.scheduled_for, b.quoted_total_paise,
  u.name  AS customer_name,
  u.phone AS customer_phone,
  s.name  AS service_name,
  a.line1, a.city, a.pincode,
  ST_Y(a.geog::geometry)::float8 AS lat,
  ST_X(a.geog::geometry)::float8 AS lng
FROM bookings b
JOIN users u          ON u.id = b.customer_id
JOIN booking_items bi ON bi.booking_id = b.id
JOIN services s       ON s.id = bi.service_id
JOIN addresses a      ON a.id = b.address_id
WHERE b.technician_id = $1
  AND b.state IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'AWAITING_COMPLETION')
ORDER BY b.scheduled_for NULLS LAST, b.created_at;

-- name: AdminListBookings :many
-- The admin console's booking list: filtered by state set, zone (city), service name, a
-- free-text search (customer name, phone, or the booking reference — the id's hex prefix),
-- and slot bounds; keyset-paginated newest-created first. state_since is when the booking
-- entered its current state (drives the "unassigned for 12m" style row notes); the review
-- join surfaces the rating a completed job earned.
SELECT
  b.id, b.state, b.scheduled_for, b.created_at, b.quoted_total_paise,
  u.name  AS customer_name,
  u.phone AS customer_phone,
  s.name  AS service_name,
  a.city,
  tu.name AS technician_name,
  COALESCE(
    (SELECT max(be.created_at) FROM booking_events be
      WHERE be.booking_id = b.id AND be.to_state = b.state),
    b.created_at
  )::timestamptz AS state_since,
  r.rating AS review_rating
FROM bookings b
JOIN users u          ON u.id = b.customer_id
JOIN booking_items bi ON bi.booking_id = b.id
JOIN services s       ON s.id = bi.service_id
JOIN addresses a      ON a.id = b.address_id
LEFT JOIN users tu    ON tu.id = b.technician_id
LEFT JOIN reviews r   ON r.booking_id = b.id
WHERE b.state = ANY(@states::text[])
  AND (sqlc.narg('zone')::text IS NULL OR a.city ILIKE sqlc.narg('zone'))
  AND (sqlc.narg('service_name')::text IS NULL OR s.name ILIKE sqlc.narg('service_name'))
  AND (sqlc.narg('search_pattern')::text IS NULL
       OR u.name  ILIKE sqlc.narg('search_pattern')
       OR u.phone LIKE  sqlc.narg('search_pattern')
       OR (sqlc.narg('reference_prefix')::text IS NOT NULL
           AND b.id::text ILIKE sqlc.narg('reference_prefix')))
  AND (sqlc.narg('slot_from')::timestamptz IS NULL
       OR COALESCE(b.scheduled_for, b.created_at) >= sqlc.narg('slot_from')::timestamptz)
  AND (sqlc.narg('slot_to')::timestamptz IS NULL
       OR COALESCE(b.scheduled_for, b.created_at) < sqlc.narg('slot_to')::timestamptz)
  AND (sqlc.narg('cursor_created_at')::timestamptz IS NULL
       OR b.created_at < sqlc.narg('cursor_created_at')::timestamptz
       OR (b.created_at = sqlc.narg('cursor_created_at')::timestamptz
           AND b.id < sqlc.narg('cursor_id')::uuid))
ORDER BY b.created_at DESC, b.id DESC
LIMIT @row_limit::int;

-- name: AdminCountBookingsByState :many
-- Per-state totals under the SAME non-state filters as AdminListBookings, so the segment
-- chips and the "Showing X of Y" line stay honest while a filter is applied.
SELECT b.state, count(*)::int AS total
FROM bookings b
JOIN users u          ON u.id = b.customer_id
JOIN booking_items bi ON bi.booking_id = b.id
JOIN services s       ON s.id = bi.service_id
JOIN addresses a      ON a.id = b.address_id
WHERE (sqlc.narg('zone')::text IS NULL OR a.city ILIKE sqlc.narg('zone'))
  AND (sqlc.narg('service_name')::text IS NULL OR s.name ILIKE sqlc.narg('service_name'))
  AND (sqlc.narg('search_pattern')::text IS NULL
       OR u.name  ILIKE sqlc.narg('search_pattern')
       OR u.phone LIKE  sqlc.narg('search_pattern')
       OR (sqlc.narg('reference_prefix')::text IS NOT NULL
           AND b.id::text ILIKE sqlc.narg('reference_prefix')))
  AND (sqlc.narg('slot_from')::timestamptz IS NULL
       OR COALESCE(b.scheduled_for, b.created_at) >= sqlc.narg('slot_from')::timestamptz)
  AND (sqlc.narg('slot_to')::timestamptz IS NULL
       OR COALESCE(b.scheduled_for, b.created_at) < sqlc.narg('slot_to')::timestamptz)
GROUP BY b.state;

-- name: AdminGetBooking :one
-- The full record behind the console's booking detail screen, joined for display: the
-- customer (with their booking count and join date), the service, the address, and the
-- assigned technician when there is one.
SELECT
  b.id, b.order_id, b.state, b.version, b.created_at, b.scheduled_for,
  b.quoted_total_paise, b.technician_id,
  u.name  AS customer_name,
  u.phone AS customer_phone,
  u.created_at AS customer_since,
  (SELECT count(*) FROM bookings other WHERE other.customer_id = b.customer_id)::int AS customer_booking_count,
  s.name AS service_name,
  a.line1, a.city, a.pincode,
  tu.name AS technician_name,
  tech.rating AS technician_rating
FROM bookings b
JOIN users u          ON u.id = b.customer_id
JOIN booking_items bi ON bi.booking_id = b.id
JOIN services s       ON s.id = bi.service_id
JOIN addresses a      ON a.id = b.address_id
LEFT JOIN users tu         ON tu.id = b.technician_id
LEFT JOIN technicians tech ON tech.user_id = b.technician_id
WHERE b.id = $1;

-- name: AdminGetBookingTimeline :many
-- Every transition a booking has been through, oldest first, with the actor named where a
-- human drove it — the console's dispatch timeline.
SELECT
  be.id, be.action, be.from_state, be.to_state, be.created_at,
  actor.name AS actor_name,
  actor.role AS actor_role
FROM booking_events be
LEFT JOIN users actor ON actor.id = be.actor_user_id
WHERE be.booking_id = $1
ORDER BY be.created_at, be.id;

-- ---------------------------------------------------------------------------
-- Admin rescue-console reads (internal/rescue). Read-only cross-module views —
-- rescue owns no aggregate; every write still goes through the owning service.

-- name: AdminAssignCandidates :many
-- The rescue console's candidate list: technicians in the booking's city who are online and
-- not on leave, ranked skill-match first, then PostGIS distance (technician's last known
-- location vs the booking address; unknown locations sort last), then acceptance and rating.
-- Busy technicians stay on the list — the console renders the on-job warning rather than
-- hiding a candidate an operator may still want.
WITH job AS (
  SELECT b.id AS booking_id, a.geog, bi.service_id, a.city
  FROM bookings b
  JOIN booking_items bi ON bi.booking_id = b.id
  JOIN addresses a      ON a.id = b.address_id
  WHERE b.id = $1
),
active_jobs AS (
  SELECT technician_id, count(*) AS count
  FROM bookings
  WHERE technician_id IS NOT NULL
    AND state IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'AWAITING_COMPLETION')
  GROUP BY technician_id
),
jobs_today AS (
  SELECT technician_id, count(*) AS count
  FROM bookings
  WHERE technician_id IS NOT NULL
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
  GROUP BY technician_id
),
outcomes AS (
  SELECT technician_id,
         (count(*) FILTER (WHERE state = 'COMPLETED'))::int AS completed,
         (count(*) FILTER (WHERE state IN ('COMPLETED', 'CANCELLED', 'FAILED')))::int AS terminal
  FROM bookings
  WHERE technician_id IS NOT NULL
  GROUP BY technician_id
)
SELECT
  t.user_id, u.name, t.rating, t.acceptance_rate, t.max_concurrent_jobs,
  COALESCE(aj.count, 0)::int AS active_jobs,
  COALESCE(jt.count, 0)::int AS jobs_today,
  COALESCE(o.completed, 0)::int  AS completed_jobs,
  COALESCE(o.terminal, 0)::int   AS terminal_jobs,
  -- -1 is the "location unknown" sentinel — the service maps it to an honest zero distance.
  COALESCE(located.metres, -1)::float8 AS distance_metres,
  COALESCE(matched.skill_name, '')::text AS matched_skill,
  (NOT EXISTS (
    SELECT 1 FROM service_required_skills srs
    WHERE srs.service_id = job.service_id
      AND srs.skill_id NOT IN (
        SELECT ts.skill_id FROM technician_skills ts WHERE ts.technician_id = t.user_id
      )
  ))::bool AS holds_required_skills
FROM technicians t
JOIN users u ON u.id = t.user_id
JOIN job     ON job.city = t.city
LEFT JOIN active_jobs aj ON aj.technician_id = t.user_id
LEFT JOIN jobs_today jt  ON jt.technician_id = t.user_id
LEFT JOIN outcomes o     ON o.technician_id = t.user_id
LEFT JOIN LATERAL (
  SELECT ST_Distance(job.geog, ST_MakePoint(t.last_lng, t.last_lat)::geography) AS metres
  WHERE t.last_lat IS NOT NULL AND t.last_lng IS NOT NULL
) located ON true
LEFT JOIN LATERAL (
  SELECT sk.name AS skill_name
  FROM service_required_skills srs
  JOIN technician_skills ts ON ts.skill_id = srs.skill_id AND ts.technician_id = t.user_id
  JOIN skills sk            ON sk.id = srs.skill_id
  WHERE srs.service_id = job.service_id
  ORDER BY sk.name
  LIMIT 1
) matched ON true
WHERE t.is_online AND NOT t.on_leave
ORDER BY (NOT EXISTS (
    SELECT 1 FROM service_required_skills srs
    WHERE srs.service_id = job.service_id
      AND srs.skill_id NOT IN (
        SELECT ts.skill_id FROM technician_skills ts WHERE ts.technician_id = t.user_id
      )
  )) DESC,
  COALESCE(located.metres, 1e12) ASC,
  t.acceptance_rate DESC, t.rating DESC, u.name
LIMIT 10;

-- name: AdminListRedispatchEvents :many
-- The recorded parameter sets of every admin redispatch — booking_events rows whose meta
-- carries the redispatch object. These are the console's dispatch rounds until the
-- automated engine records rounds of its own.
SELECT be.meta, be.created_at
FROM booking_events be
WHERE be.booking_id = $1
  AND be.meta -> 'redispatch' IS NOT NULL
ORDER BY be.created_at, be.id;

-- name: AdminCountAdminCompletionsSince :one
-- How often THIS admin has manually completed bookings recently — the frequency counter the
-- manual-completion screen shows against its 30-minute lock.
SELECT count(*)::int AS total
FROM booking_events be
WHERE be.action = 'VERIFY_COMPLETION'
  AND be.actor_user_id = $1
  AND be.created_at >= $2;

-- name: AdminCountTechnicianCompletionsSince :one
-- How many completions this booking's technician has accumulated recently — the other
-- frequency counter behind a manual completion.
SELECT count(*)::int AS total
FROM booking_events be
JOIN bookings b ON b.id = be.booking_id
WHERE be.action = 'VERIFY_COMPLETION'
  AND b.technician_id = $1
  AND be.created_at >= $2;

-- name: AdminListWorkPhotoIDs :many
-- The work-photo evidence recorded for a booking (verification owns the writes; this is a
-- read-only evidence listing for the manual-completion screen).
SELECT id
FROM work_photos
WHERE booking_id = $1
ORDER BY created_at, id;
