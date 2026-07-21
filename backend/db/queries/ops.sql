-- name: ListAssignmentQueue :many
-- Bookings waiting for a human to assign a technician: those the auto-ladder is working
-- (SEARCHING) and those it escalated (ESCALATED). Oldest first — the customer who has waited
-- longest is served first.
SELECT
  b.id, b.state, b.scheduled_for, b.quoted_total_paise, b.created_at,
  u.name  AS customer_name,
  u.phone AS customer_phone,
  s.name  AS service_name,
  a.city, a.line1
FROM bookings b
JOIN users u          ON u.id = b.customer_id
JOIN booking_items bi ON bi.booking_id = b.id
JOIN services s       ON s.id = bi.service_id
JOIN addresses a      ON a.id = b.address_id
WHERE b.state IN ('SEARCHING', 'ESCALATED')
ORDER BY b.created_at;

-- name: ListCandidateTechnicians :many
-- The §5.1 eligibility model, minus the PostGIS distance ranking (that is P2). A technician
-- is a candidate for a booking when ALL hold:
--   * same city as the job (a coarse stand-in for service radius until P2),
--   * online and not on leave,
--   * holds EVERY skill the service requires,
--   * below their max-concurrent-jobs limit.
-- Ranked by acceptance rate then rating — the §5.1 ranking signals we have today.
WITH job AS (
  SELECT bi.service_id, a.city,
         -- The minute-of-day the job happens (scheduled time, or now for an immediate job),
         -- in IST — compared against the technician's shift window below.
         (EXTRACT(HOUR   FROM COALESCE(b.scheduled_for, now()) AT TIME ZONE 'Asia/Kolkata') * 60
        + EXTRACT(MINUTE FROM COALESCE(b.scheduled_for, now()) AT TIME ZONE 'Asia/Kolkata'))::int AS job_minute
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
)
SELECT
  t.user_id, u.name, t.city, t.acceptance_rate, t.rating,
  t.max_concurrent_jobs,
  COALESCE(aj.count, 0)::int AS active_jobs
FROM technicians t
JOIN users u ON u.id = t.user_id
JOIN job     ON job.city = t.city
LEFT JOIN active_jobs aj ON aj.technician_id = t.user_id
WHERE t.is_online
  AND NOT t.on_leave
  AND job.job_minute BETWEEN t.shift_start_minute AND t.shift_end_minute
  AND COALESCE(aj.count, 0) < t.max_concurrent_jobs
  AND NOT EXISTS (
    SELECT 1
    FROM service_required_skills srs
    WHERE srs.service_id = job.service_id
      AND srs.skill_id NOT IN (
        SELECT ts.skill_id FROM technician_skills ts WHERE ts.technician_id = t.user_id
      )
  )
ORDER BY t.acceptance_rate DESC, t.rating DESC;

-- name: TechnicianExists :one
SELECT EXISTS (SELECT 1 FROM technicians WHERE user_id = $1) AS exists;

-- name: ListTechnicians :many
-- Every technician with their status and current load — the admin console's Employees view.
WITH active_jobs AS (
  SELECT technician_id, count(*) AS count
  FROM bookings
  WHERE technician_id IS NOT NULL
    AND state IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'AWAITING_COMPLETION')
  GROUP BY technician_id
)
SELECT
  t.user_id, u.name, t.city, t.is_online, t.on_leave,
  t.acceptance_rate, t.rating, t.max_concurrent_jobs,
  COALESCE(aj.count, 0)::int AS active_jobs
FROM technicians t
JOIN users u ON u.id = t.user_id
LEFT JOIN active_jobs aj ON aj.technician_id = t.user_id
ORDER BY u.name;
