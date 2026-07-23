-- The admin console's provider surface (internal/providerops): the roster read model, the
-- provider profile aggregates, the standing writes (suspend / block / restore), and the
-- provider-application pipeline.
--
-- The roster STATUS is derived, never stored: BLOCKED standing -> offboarded; a live
-- SUSPENDED standing -> suspended; an active booking -> on_job; online + not on leave +
-- seen recently -> free; anything else -> offline. "Seen recently" reads
-- GREATEST(updated_at, last_location_at) so a technician who toggled online but never
-- shared a location is still fresh for the staleness window after the toggle.

-- name: AdminListProviderRoster :many
WITH derived AS (
  SELECT
    t.user_id,
    u.name,
    u.phone,
    t.city AS zone,
    t.rating,
    GREATEST(t.updated_at, COALESCE(t.last_location_at, t.updated_at)) AS last_seen_at,
    st.suspended_until,
    CASE
      WHEN st.standing = 'BLOCKED' THEN 'offboarded'
      WHEN st.standing = 'SUSPENDED' AND st.suspended_until > now() THEN 'suspended'
      WHEN EXISTS (SELECT 1 FROM bookings b
                    WHERE b.technician_id = t.user_id
                      AND b.state IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'AWAITING_COMPLETION'))
        THEN 'on_job'
      WHEN t.is_online AND NOT t.on_leave
           AND GREATEST(t.updated_at, COALESCE(t.last_location_at, t.updated_at))
               > now() - make_interval(secs => @stale_after_seconds::int)
        THEN 'free'
      ELSE 'offline'
    END::text AS status
  FROM technicians t
  JOIN users u ON u.id = t.user_id
  LEFT JOIN provider_admin_states st ON st.technician_id = t.user_id
  WHERE u.deleted_at IS NULL
)
SELECT
  d.user_id, d.name, d.zone, d.status, d.rating, d.suspended_until,
  d.last_seen_at::timestamptz AS last_seen_at,
  COALESCE(skill_list.names, '{}')::text[] AS skills,
  COALESCE(window_stats.completed, 0)::int AS completed_90,
  COALESCE(window_stats.terminal, 0)::int  AS terminal_90,
  COALESCE(today.completed, 0)::int        AS completed_today,
  COALESCE(today.earnings, 0)::bigint      AS earnings_today,
  COALESCE(active.jobs, 0)::int            AS active_jobs
FROM derived d
LEFT JOIN LATERAL (
  SELECT array_agg(sk.name ORDER BY sk.name) AS names
  FROM technician_skills ts
  JOIN skills sk ON sk.id = ts.skill_id
  WHERE ts.technician_id = d.user_id
) skill_list ON true
LEFT JOIN LATERAL (
  SELECT count(*) FILTER (WHERE b.state = 'COMPLETED') AS completed,
         count(*) FILTER (WHERE b.state IN ('COMPLETED', 'CANCELLED', 'FAILED')) AS terminal
  FROM bookings b
  WHERE b.technician_id = d.user_id
    AND b.created_at > now() - interval '90 days'
) window_stats ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS completed, COALESCE(sum(b.quoted_total_paise), 0) AS earnings
  FROM bookings b
  JOIN booking_events be ON be.booking_id = b.id AND be.to_state = 'COMPLETED'
  WHERE b.technician_id = d.user_id
    AND be.created_at >= @today_start::timestamptz
) today ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS jobs
  FROM bookings b
  WHERE b.technician_id = d.user_id
    AND b.state IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'AWAITING_COMPLETION')
) active ON true
WHERE (cardinality(@statuses::text[]) = 0 OR d.status = ANY(@statuses::text[]))
  AND (sqlc.narg('search_pattern')::text IS NULL
       OR d.name  ILIKE sqlc.narg('search_pattern')
       OR d.phone LIKE  sqlc.narg('search_pattern')
       OR d.zone  ILIKE sqlc.narg('search_pattern'))
  AND (sqlc.narg('cursor_name')::text IS NULL
       OR d.name > sqlc.narg('cursor_name')::text
       OR (d.name = sqlc.narg('cursor_name')::text AND d.user_id > sqlc.narg('cursor_id')::uuid))
ORDER BY d.name, d.user_id
LIMIT @row_limit::int;

-- name: AdminProviderCurrentJobs :many
-- The most recently touched live booking per technician, for the roster page's stage cell.
-- Batched over the page's ids; a technician with no live job simply has no row.
SELECT DISTINCT ON (b.technician_id)
  b.technician_id, b.id, b.state
FROM bookings b
WHERE b.technician_id = ANY(@technician_ids::uuid[])
  AND b.state IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'AWAITING_COMPLETION')
ORDER BY b.technician_id, b.updated_at DESC;

-- name: AdminCountProviderRoster :many
-- Per-derived-status totals under the SAME search filter as the roster page (but not the
-- segment filter), so the segment chips stay honest while a search is applied.
WITH derived AS (
  SELECT
    u.name,
    u.phone,
    t.city AS zone,
    CASE
      WHEN st.standing = 'BLOCKED' THEN 'offboarded'
      WHEN st.standing = 'SUSPENDED' AND st.suspended_until > now() THEN 'suspended'
      WHEN EXISTS (SELECT 1 FROM bookings b
                    WHERE b.technician_id = t.user_id
                      AND b.state IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'AWAITING_COMPLETION'))
        THEN 'on_job'
      WHEN t.is_online AND NOT t.on_leave
           AND GREATEST(t.updated_at, COALESCE(t.last_location_at, t.updated_at))
               > now() - make_interval(secs => @stale_after_seconds::int)
        THEN 'free'
      ELSE 'offline'
    END::text AS status
  FROM technicians t
  JOIN users u ON u.id = t.user_id
  LEFT JOIN provider_admin_states st ON st.technician_id = t.user_id
  WHERE u.deleted_at IS NULL
)
SELECT d.status, count(*)::int AS total
FROM derived d
WHERE (sqlc.narg('search_pattern')::text IS NULL
       OR d.name  ILIKE sqlc.narg('search_pattern')
       OR d.phone LIKE  sqlc.narg('search_pattern')
       OR d.zone  ILIKE sqlc.narg('search_pattern'))
GROUP BY d.status;

-- name: AdminZoneOnlineCounts :many
-- Online (free or on-job) providers per zone — the roster's supply-health strip.
WITH derived AS (
  SELECT
    t.city AS zone,
    CASE
      WHEN st.standing = 'BLOCKED' THEN 'offboarded'
      WHEN st.standing = 'SUSPENDED' AND st.suspended_until > now() THEN 'suspended'
      WHEN EXISTS (SELECT 1 FROM bookings b
                    WHERE b.technician_id = t.user_id
                      AND b.state IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'AWAITING_COMPLETION'))
        THEN 'on_job'
      WHEN t.is_online AND NOT t.on_leave
           AND GREATEST(t.updated_at, COALESCE(t.last_location_at, t.updated_at))
               > now() - make_interval(secs => @stale_after_seconds::int)
        THEN 'free'
      ELSE 'offline'
    END::text AS status
  FROM technicians t
  JOIN users u ON u.id = t.user_id
  LEFT JOIN provider_admin_states st ON st.technician_id = t.user_id
  WHERE u.deleted_at IS NULL
)
SELECT d.zone, count(*) FILTER (WHERE d.status IN ('free', 'on_job'))::int AS online_count
FROM derived d
GROUP BY d.zone
ORDER BY d.zone;

-- name: AdminGetProvider :one
-- The provider profile's core row: identity, standing (absent row = ACTIVE at version 0)
-- and the same derived status the roster computes.
SELECT
  t.user_id,
  u.name,
  u.phone,
  u.created_at AS joined_at,
  t.city AS zone,
  t.rating,
  GREATEST(t.updated_at, COALESCE(t.last_location_at, t.updated_at))::timestamptz AS last_seen_at,
  st.standing,
  st.reason_code,
  st.note AS standing_note,
  st.suspended_until,
  st.decided_at,
  COALESCE(st.version, 0)::bigint AS standing_version,
  decider.name AS decided_by_name,
  CASE
    WHEN st.standing = 'BLOCKED' THEN 'offboarded'
    WHEN st.standing = 'SUSPENDED' AND st.suspended_until > now() THEN 'suspended'
    WHEN EXISTS (SELECT 1 FROM bookings b
                  WHERE b.technician_id = t.user_id
                    AND b.state IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'AWAITING_COMPLETION'))
      THEN 'on_job'
    WHEN t.is_online AND NOT t.on_leave
         AND GREATEST(t.updated_at, COALESCE(t.last_location_at, t.updated_at))
             > now() - make_interval(secs => @stale_after_seconds::int)
      THEN 'free'
    ELSE 'offline'
  END::text AS status
FROM technicians t
JOIN users u ON u.id = t.user_id
LEFT JOIN provider_admin_states st ON st.technician_id = t.user_id
LEFT JOIN users decider ON decider.id = st.decided_by
WHERE t.user_id = @technician_id AND u.deleted_at IS NULL;

-- name: AdminProviderJobStats :one
-- The profile's headline aggregates, all from real bookings. "Completed today/this cycle"
-- is dated by the booking_events row that moved the booking to COMPLETED.
SELECT
  (SELECT count(*) FROM bookings b
    WHERE b.technician_id = @technician_id AND b.state = 'COMPLETED')::int AS jobs_total,
  (SELECT count(*) FROM bookings b
    JOIN booking_events be ON be.booking_id = b.id AND be.to_state = 'COMPLETED'
    WHERE b.technician_id = @technician_id
      AND be.created_at >= @today_start::timestamptz)::int AS completed_today,
  (SELECT count(*) FROM bookings b
    WHERE b.technician_id = @technician_id
      AND b.state IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'AWAITING_COMPLETION'))::int AS active_now,
  (SELECT COALESCE(sum(b.quoted_total_paise), 0) FROM bookings b
    JOIN booking_events be ON be.booking_id = b.id AND be.to_state = 'COMPLETED'
    WHERE b.technician_id = @technician_id
      AND be.created_at >= @today_start::timestamptz)::bigint AS earnings_today,
  (SELECT COALESCE(sum(b.quoted_total_paise), 0) FROM bookings b
    JOIN booking_events be ON be.booking_id = b.id AND be.to_state = 'COMPLETED'
    WHERE b.technician_id = @technician_id
      AND be.created_at >= @cycle_start::timestamptz)::bigint AS cycle_revenue;

-- name: AdminProviderPerformanceBuckets :many
-- The 90-day performance trend in 8 equal buckets (by booking creation): jobs assigned,
-- completions, cancellations/failures, terminal outcomes and escalations.
SELECT
  width_bucket(
    EXTRACT(EPOCH FROM b.created_at),
    EXTRACT(EPOCH FROM @from_time::timestamptz),
    EXTRACT(EPOCH FROM @to_time::timestamptz), 8
  )::int AS bucket,
  count(*)::int AS assigned,
  count(*) FILTER (WHERE b.state = 'COMPLETED')::int AS completed,
  count(*) FILTER (WHERE b.state IN ('CANCELLED', 'FAILED'))::int AS cancelled,
  count(*) FILTER (WHERE b.state IN ('COMPLETED', 'CANCELLED', 'FAILED'))::int AS terminal,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM booking_events be
    WHERE be.booking_id = b.id AND be.to_state = 'ESCALATED'))::int AS escalated
FROM bookings b
WHERE b.technician_id = @technician_id
  AND b.created_at >= @from_time::timestamptz AND b.created_at < @to_time::timestamptz
GROUP BY 1;

-- name: AdminProviderRatingBuckets :many
-- Review ratings over the same 8-bucket window, for the rating trend.
SELECT
  width_bucket(
    EXTRACT(EPOCH FROM r.created_at),
    EXTRACT(EPOCH FROM @from_time::timestamptz),
    EXTRACT(EPOCH FROM @to_time::timestamptz), 8
  )::int AS bucket,
  avg(r.rating)::float8 AS avg_rating
FROM reviews r
WHERE r.technician_id = @technician_id
  AND r.created_at >= @from_time::timestamptz AND r.created_at < @to_time::timestamptz
GROUP BY 1;

-- name: AdminProviderSkills :many
SELECT sk.name
FROM technician_skills ts
JOIN skills sk ON sk.id = ts.skill_id
WHERE ts.technician_id = @technician_id
ORDER BY sk.name;

-- name: AdminProviderRecentJobs :many
-- The profile's recent-jobs table: finished bookings, newest first, with the review each
-- one earned. state_at is when the booking reached its terminal state.
SELECT
  b.id, b.state, b.created_at, b.quoted_total_paise,
  s.name AS service_name,
  r.rating AS review_rating,
  COALESCE(
    (SELECT max(be.created_at) FROM booking_events be
      WHERE be.booking_id = b.id AND be.to_state = b.state),
    b.created_at
  )::timestamptz AS state_at
FROM bookings b
JOIN booking_items bi ON bi.booking_id = b.id
JOIN services s       ON s.id = bi.service_id
LEFT JOIN reviews r   ON r.booking_id = b.id
WHERE b.technician_id = @technician_id
  AND b.state IN ('COMPLETED', 'CANCELLED', 'FAILED')
ORDER BY b.created_at DESC, b.id DESC
LIMIT @row_limit::int;

-- name: AdminProviderFeedback :many
-- Written customer feedback, newest first.
SELECT r.id, r.rating, r.comment, r.created_at, u.name AS author
FROM reviews r
JOIN users u ON u.id = r.customer_id
WHERE r.technician_id = @technician_id AND r.comment <> ''
ORDER BY r.created_at DESC, r.id DESC
LIMIT @row_limit::int;

-- name: AdminProviderActiveJobs :many
-- The provider's live jobs — step 3 of the suspend flow. started_at is the VERIFY_START
-- transition when work has begun.
SELECT
  b.id, b.state, b.quoted_total_paise,
  u.name AS customer_name,
  s.name AS service_name,
  a.city,
  (SELECT max(be.created_at) FROM booking_events be
    WHERE be.booking_id = b.id AND be.action = 'VERIFY_START')::timestamptz AS started_at
FROM bookings b
JOIN users u          ON u.id = b.customer_id
JOIN booking_items bi ON bi.booking_id = b.id
JOIN services s       ON s.id = bi.service_id
JOIN addresses a      ON a.id = b.address_id
WHERE b.technician_id = @technician_id
  AND b.state IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'AWAITING_COMPLETION')
ORDER BY b.created_at, b.id;

-- name: GetProviderStandingVersion :one
-- The optimistic-concurrency read for standing writes. No row means ACTIVE at version 0
-- (the caller treats ErrNoRows that way).
SELECT standing, version
FROM provider_admin_states
WHERE technician_id = @technician_id;

-- name: UpsertProviderStanding :one
-- THE COMPARE-AND-SWAP for a standing change. A first-ever write inserts at version 1 (the
-- service has already verified the expected version was 0, inside the same transaction); a
-- later write only lands when the version still matches — zero rows means another admin got
-- there first, which the service turns into the 409 the console renders.
INSERT INTO provider_admin_states AS pas
    (technician_id, standing, reason_code, note, suspended_until, decided_by, decided_at)
VALUES (@technician_id, @standing, sqlc.narg('reason_code'), @note,
        sqlc.narg('suspended_until'), @decided_by, now())
ON CONFLICT (technician_id) DO UPDATE
   SET standing        = EXCLUDED.standing,
       reason_code     = EXCLUDED.reason_code,
       note            = EXCLUDED.note,
       suspended_until = EXCLUDED.suspended_until,
       decided_by      = EXCLUDED.decided_by,
       decided_at      = now(),
       updated_at      = now(),
       version         = pas.version + 1
 WHERE pas.version = @expected_version
RETURNING version;

-- name: BumpProviderStandingVersion :one
-- Force-offline changes availability (identity's aggregate), not standing — but it still
-- consumes the provider's concurrency token, so two admins acting on a stale profile still
-- collide. Inserts the implicit ACTIVE row on first touch.
INSERT INTO provider_admin_states AS pas (technician_id)
VALUES (@technician_id)
ON CONFLICT (technician_id) DO UPDATE
   SET updated_at = now(),
       version    = pas.version + 1
 WHERE pas.version = @expected_version
RETURNING version;

-- ---------------------------------------------------------------------------
-- Applications

-- name: AdminApplicationsSummary :one
-- Queue chip counts plus the age of the oldest undecided application (the 48h SLA clock).
SELECT
  count(*) FILTER (WHERE status = 'pending')::int AS pending,
  count(*) FILTER (WHERE status = 'awaiting_docs')::int AS awaiting_docs,
  count(*) FILTER (WHERE status IN ('approved', 'rejected'))::int AS decided,
  (min(applied_at) FILTER (WHERE status IN ('pending', 'awaiting_docs')))::timestamptz AS oldest_undecided_at
FROM provider_applications;

-- name: AdminListApplications :many
-- The application queue, oldest first (the applicant who has waited longest is reviewed
-- first), keyset-paginated on (applied_at, id).
SELECT
  a.id, a.applicant_name, a.zone, a.applied_at, a.status, a.decided_at, a.documents_required,
  COALESCE(docs.present, 0)::int AS documents_present,
  COALESCE(cats.names, '{}')::text[] AS categories
FROM provider_applications a
LEFT JOIN LATERAL (
  SELECT count(*) FILTER (WHERE d.validation <> 'missing') AS present
  FROM provider_application_documents d
  WHERE d.application_id = a.id
) docs ON true
LEFT JOIN LATERAL (
  SELECT array_agg(c.name ORDER BY c.name) AS names
  FROM provider_application_categories c
  WHERE c.application_id = a.id
) cats ON true
WHERE a.status = ANY(@statuses::text[])
  AND (sqlc.narg('cursor_applied_at')::timestamptz IS NULL
       OR a.applied_at > sqlc.narg('cursor_applied_at')::timestamptz
       OR (a.applied_at = sqlc.narg('cursor_applied_at')::timestamptz
           AND a.id > sqlc.narg('cursor_id')::uuid))
ORDER BY a.applied_at, a.id
LIMIT @row_limit::int;

-- name: AdminApplicationsAwaitingTypes :many
-- The first still-missing document per application, for "awaiting police verification"
-- rows. Batched over the page's ids; an application missing nothing has no row.
SELECT DISTINCT ON (d.application_id)
  d.application_id, d.document_type
FROM provider_application_documents d
WHERE d.application_id = ANY(@application_ids::uuid[])
  AND d.validation = 'missing'
ORDER BY d.application_id, d.created_at, d.document_type;

-- name: AdminGetApplication :one
SELECT
  a.id, a.applicant_name, a.phone, a.email, a.address, a.zone, a.status,
  a.documents_required, a.background_cleared_at, a.applied_at,
  a.decided_at, a.decision_reason_code, a.decision_note, a.version,
  a.documents_requested_at, a.documents_request_note,
  decider.name AS decided_by_name
FROM provider_applications a
LEFT JOIN users decider ON decider.id = a.decided_by
WHERE a.id = @application_id;

-- name: AdminApplicationCategories :many
SELECT name, years_claimed
FROM provider_application_categories
WHERE application_id = @application_id
ORDER BY name;

-- name: AdminApplicationDocuments :many
SELECT id, document_type, validation, uploaded_at, expires_at, detail,
       ocr_read, ocr_expected, size_bytes, url
FROM provider_application_documents
WHERE application_id = @application_id
ORDER BY created_at, document_type;

-- name: AdminCountPriorApplications :one
-- Earlier applications from the same phone — surfaced on the review screen.
SELECT count(*)::int AS prior
FROM provider_applications
WHERE phone = @phone AND id <> @application_id;

-- name: DecideApplication :one
-- THE COMPARE-AND-SWAP for a decision, doubly guarded: the version must match AND the
-- application must still be undecided (a decision is terminal — approved/rejected rows can
-- never be decided again, whatever version a caller replays).
UPDATE provider_applications
   SET status                 = @status,
       decided_at             = now(),
       decided_by             = @decided_by,
       decision_reason_code   = sqlc.narg('decision_reason_code'),
       decision_note          = @decision_note,
       approved_technician_id = sqlc.narg('approved_technician_id'),
       updated_at             = now(),
       version                = version + 1
 WHERE id = @application_id
   AND version = @expected_version
   AND status IN ('pending', 'awaiting_docs')
RETURNING version;

-- name: MarkApplicationAwaitingDocuments :one
-- Request-documents: same CAS + still-undecided guard as a decision.
UPDATE provider_applications
   SET status                 = 'awaiting_docs',
       documents_requested_at = now(),
       documents_request_note = @note,
       updated_at             = now(),
       version                = version + 1
 WHERE id = @application_id
   AND version = @expected_version
   AND status IN ('pending', 'awaiting_docs')
RETURNING version, documents_requested_at;

-- name: EnsureApplicationDocumentRequested :exec
-- A requested document appears on the checklist as 'missing' until the applicant files it.
-- Idempotent: re-requesting a type that already has a row changes nothing.
INSERT INTO provider_application_documents (application_id, document_type)
VALUES (@application_id, @document_type)
ON CONFLICT (application_id, document_type) DO NOTHING;
