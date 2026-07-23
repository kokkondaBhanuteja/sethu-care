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
--   * not under an admin restriction (suspended/blocked in provider_admin_states),
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
  -- An admin restriction takes the technician out of dispatch: a permanent block, or a
  -- suspension that has not yet expired.
  AND NOT EXISTS (
    SELECT 1
    FROM provider_admin_states pas
    WHERE pas.technician_id = t.user_id
      AND (pas.standing = 'BLOCKED'
           OR (pas.standing = 'SUSPENDED' AND pas.suspended_until > now()))
  )
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

-- name: ListAttentionQueue :many
-- The needs-attention queue behind the admin dashboard: the same SEARCHING/ESCALATED set as
-- the assignment queue, enriched with when the booking ENTERED its current state (the moment
-- the problem surfaced). Ordered the way the console renders it — ESCALATED tier first, then
-- oldest surfaced first — so the server, not the client, owns the priority order.
SELECT
  b.id, b.state, b.scheduled_for, b.quoted_total_paise, b.created_at,
  u.name AS customer_name,
  s.name AS service_name,
  a.city,
  COALESCE(
    (SELECT max(be.created_at) FROM booking_events be
      WHERE be.booking_id = b.id AND be.to_state = b.state),
    b.created_at
  )::timestamptz AS surfaced_at
FROM bookings b
JOIN users u          ON u.id = b.customer_id
JOIN booking_items bi ON bi.booking_id = b.id
JOIN services s       ON s.id = bi.service_id
JOIN addresses a      ON a.id = b.address_id
WHERE b.state IN ('SEARCHING', 'ESCALATED')
ORDER BY (b.state = 'ESCALATED') DESC, surfaced_at, b.id;

-- name: CountHealthyJobs :one
-- Jobs progressing normally right now — everything a technician is actively working. The
-- dashboard's all-clear state counts these instead of showing a zero.
SELECT count(*)::int AS healthy
FROM bookings
WHERE state IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'AWAITING_COMPLETION');

-- name: GetLastAttentionClear :one
-- The most recent manual assignment by an admin — the last time a human cleared something
-- from the attention queue. Cited by the dashboard's all-clear state.
SELECT be.created_at, be.booking_id, u.name AS admin_name
FROM booking_events be
JOIN users u ON u.id = be.actor_user_id
WHERE be.action = 'ASSIGN' AND u.role = 'ADMIN'
ORDER BY be.created_at DESC
LIMIT 1;

-- name: ListRecentBookingActivity :many
-- The last N booking transitions the console's activity feed can name: only the actions its
-- closed activity vocabulary covers. CANCEL rows count only when the customer did the
-- cancelling — the feed's kind is cancelled_by_customer, and labelling an admin cancel with
-- it would lie. technician_name is the booking's CURRENT technician (booking_events does not
-- record which technician an ASSIGN put on the job).
SELECT
  be.id, be.booking_id, be.action, be.created_at,
  tu.name AS technician_name
FROM booking_events be
JOIN bookings b ON b.id = be.booking_id
LEFT JOIN users actor ON actor.id = be.actor_user_id
LEFT JOIN users tu    ON tu.id = b.technician_id
WHERE be.action IN ('ASSIGN', 'DEPART', 'VERIFY_START', 'REQUEST_COMPLETION', 'VERIFY_COMPLETION')
   OR (be.action = 'CANCEL' AND actor.role = 'CUSTOMER')
ORDER BY be.created_at DESC, be.id DESC
LIMIT @row_limit::int;

-- name: DashboardBookingsByBucket :many
-- Bookings created in [from, to), grouped into 8 equal time buckets (1-based) for the
-- dashboard sparkline. Empty buckets are absent; the service fills the zeroes.
SELECT
  width_bucket(
    EXTRACT(EPOCH FROM created_at),
    EXTRACT(EPOCH FROM @from_time::timestamptz),
    EXTRACT(EPOCH FROM @to_time::timestamptz), 8
  )::int AS bucket,
  count(*)::int AS bookings
FROM bookings
WHERE created_at >= @from_time::timestamptz AND created_at < @to_time::timestamptz
GROUP BY 1;

-- name: DashboardRevenueByBucket :many
-- REVENUE ledger entries in [from, to), bucketed as above. Read-only: ops reads the ledger's
-- table for the console's aggregates; it never writes money.
SELECT
  width_bucket(
    EXTRACT(EPOCH FROM created_at),
    EXTRACT(EPOCH FROM @from_time::timestamptz),
    EXTRACT(EPOCH FROM @to_time::timestamptz), 8
  )::int AS bucket,
  SUM(amount_paise)::bigint AS revenue_paise
FROM ledger_entries
WHERE kind = 'REVENUE'
  AND created_at >= @from_time::timestamptz AND created_at < @to_time::timestamptz
GROUP BY 1;

-- name: DashboardOutcomesByBucket :many
-- Terminal outcomes in [from, to): how many bookings ENDED in each bucket, and how many of
-- those endings were completions — the completion-rate numerator and denominator.
SELECT
  width_bucket(
    EXTRACT(EPOCH FROM created_at),
    EXTRACT(EPOCH FROM @from_time::timestamptz),
    EXTRACT(EPOCH FROM @to_time::timestamptz), 8
  )::int AS bucket,
  (count(*) FILTER (WHERE to_state = 'COMPLETED'))::int AS completed,
  count(*)::int AS terminal
FROM booking_events
WHERE to_state IN ('COMPLETED', 'CANCELLED', 'FAILED')
  AND created_at >= @from_time::timestamptz AND created_at < @to_time::timestamptz
GROUP BY 1;

-- name: DashboardAssignByBucket :many
-- SEARCHING -> ASSIGNED latency per bucket: for every assignment in [from, to), the delta
-- from the most recent SEARCHING entry for the same booking. Sum + count per bucket so the
-- caller can compute both the bucket mean and the window mean without a second query.
SELECT
  width_bucket(
    EXTRACT(EPOCH FROM assigned.created_at),
    EXTRACT(EPOCH FROM @from_time::timestamptz),
    EXTRACT(EPOCH FROM @to_time::timestamptz), 8
  )::int AS bucket,
  SUM(EXTRACT(EPOCH FROM (assigned.created_at - searching.created_at)) * 1000)::bigint AS total_ms,
  count(*)::int AS pairs
FROM booking_events assigned
JOIN LATERAL (
  SELECT prior.created_at
  FROM booking_events prior
  WHERE prior.booking_id = assigned.booking_id
    AND prior.to_state = 'SEARCHING'
    AND prior.created_at <= assigned.created_at
  ORDER BY prior.created_at DESC
  LIMIT 1
) searching ON true
WHERE assigned.action = 'ASSIGN' AND assigned.to_state = 'ASSIGNED'
  AND assigned.created_at >= @from_time::timestamptz AND assigned.created_at < @to_time::timestamptz
GROUP BY 1;
