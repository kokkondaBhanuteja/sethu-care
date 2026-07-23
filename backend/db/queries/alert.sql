-- name: InsertSubjectAlert :execrows
-- The alert engine's one write: an alert about a subject, born from an outbox event.
-- ON CONFLICT DO NOTHING covers BOTH idempotency guards — the redelivered event
-- (source_event_id UNIQUE) and the already-open alert for the same (kind, subject).
INSERT INTO alerts (kind, severity, subject_kind, subject_id, source_event_id, requires_acknowledgement)
VALUES (@kind, @severity, @subject_kind, @subject_id, @source_event_id, @requires_acknowledgement)
ON CONFLICT DO NOTHING;

-- name: ListAlerts :many
-- The alert feed, newest first, keyset-paginated. Booking context (service, city) is joined
-- read-only so the title/summary interpolation values are derived at read time — the alert
-- row stores facts, not display strings. Rows whose subject booking has vanished still list
-- (LEFT JOINs): an alert must never disappear because its subject did.
SELECT
  al.id, al.kind, al.severity, al.subject_kind, al.subject_id,
  al.requires_acknowledgement, al.acknowledged_by, al.acknowledged_at, al.created_at,
  acknowledger.name AS acknowledger_name,
  s.name  AS service_name,
  addr.city
FROM alerts al
LEFT JOIN users acknowledger  ON acknowledger.id = al.acknowledged_by
LEFT JOIN bookings b          ON al.subject_kind = 'BOOKING' AND b.id = al.subject_id
LEFT JOIN booking_items bi    ON bi.booking_id = b.id
LEFT JOIN services s          ON s.id = bi.service_id
LEFT JOIN addresses addr      ON addr.id = b.address_id
WHERE (sqlc.narg('severity_filter')::text IS NULL OR al.severity = sqlc.narg('severity_filter')::text)
  AND (sqlc.narg('acknowledged_filter')::boolean IS NULL
       OR (al.acknowledged_at IS NOT NULL) = sqlc.narg('acknowledged_filter')::boolean)
  AND (sqlc.narg('cursor_created_at')::timestamptz IS NULL
       OR al.created_at < sqlc.narg('cursor_created_at')::timestamptz
       OR (al.created_at = sqlc.narg('cursor_created_at')::timestamptz
           AND al.id < sqlc.narg('cursor_id')::uuid))
ORDER BY al.created_at DESC, al.id DESC
LIMIT @row_limit::int;

-- name: CountAlerts :one
-- Whole-set total for the same filter as ListAlerts (minus the cursor).
SELECT count(*)::int AS total
FROM alerts al
WHERE (sqlc.narg('severity_filter')::text IS NULL OR al.severity = sqlc.narg('severity_filter')::text)
  AND (sqlc.narg('acknowledged_filter')::boolean IS NULL
       OR (al.acknowledged_at IS NOT NULL) = sqlc.narg('acknowledged_filter')::boolean);

-- name: GetAlert :one
-- One alert by its OWN id, with the same read-time context as the list.
SELECT
  al.id, al.kind, al.severity, al.subject_kind, al.subject_id,
  al.requires_acknowledgement, al.acknowledged_by, al.acknowledged_at, al.created_at,
  acknowledger.name AS acknowledger_name,
  s.name  AS service_name,
  addr.city,
  customer.name AS customer_name,
  b.state AS booking_state,
  -- COALESCEd so a subjectless alert still scans; booking_state IS NULL says whether the
  -- amount is real or the placeholder zero.
  COALESCE(b.quoted_total_paise, 0) AS booking_total_paise,
  b.created_at AS booking_created_at
FROM alerts al
LEFT JOIN users acknowledger  ON acknowledger.id = al.acknowledged_by
LEFT JOIN bookings b          ON al.subject_kind = 'BOOKING' AND b.id = al.subject_id
LEFT JOIN users customer      ON customer.id = b.customer_id
LEFT JOIN booking_items bi    ON bi.booking_id = b.id
LEFT JOIN services s          ON s.id = bi.service_id
LEFT JOIN addresses addr      ON addr.id = b.address_id
WHERE al.id = @id;

-- name: GetNewestAlertIDBySubject :one
-- The phase-1 id convention: the attention queue advertised alertId = booking id before the
-- alerts table existed, so a subject id resolves to that subject's newest alert.
SELECT id FROM alerts
WHERE subject_id = @subject_id
ORDER BY created_at DESC, id DESC
LIMIT 1;

-- name: ListAlertsBySubject :many
-- The other alerts about the same subject, for the detail's related-alerts rail.
SELECT al.id, al.kind, al.severity, al.created_at
FROM alerts al
WHERE al.subject_id = @subject_id AND al.id <> @excluding_id
ORDER BY al.created_at DESC, al.id DESC;

-- name: AcknowledgeAlert :one
-- First writer wins: the WHERE arm makes two racing admins resolve in the database, and a
-- zero-row result tells the service somebody else already owns it (or the id is unknown).
UPDATE alerts
SET acknowledged_by = @admin_id, acknowledged_at = now()
WHERE id = @id AND acknowledged_at IS NULL
RETURNING id, acknowledged_at;

-- name: MarkInformationalAlertsRead :execrows
-- The read-all sweep. The requires_acknowledgement guard is the badge-discipline rule: a
-- critical alert can only leave the needs-action tier through acknowledgeAlert.
UPDATE alerts
SET read_at = now()
WHERE requires_acknowledgement = false AND read_at IS NULL;

-- name: CountOpenCriticalAlerts :one
-- Unacknowledged criticals — the shell badge and the dashboard band's number.
SELECT count(*)::int AS open_critical
FROM alerts
WHERE requires_acknowledgement AND acknowledged_at IS NULL;

-- name: ListOpenCriticalAlertExamples :many
-- The band's example refs: the newest unacknowledged criticals, at most @row_limit.
SELECT al.id, al.kind, al.subject_kind, al.subject_id, al.created_at
FROM alerts al
WHERE al.requires_acknowledgement AND al.acknowledged_at IS NULL
ORDER BY al.created_at DESC, al.id DESC
LIMIT @row_limit::int;

-- name: InsertAlertNote :exec
-- Replay-safe note write: a retried Idempotency-Key lands on the unique index and no-ops;
-- GetAlertNoteByKey then returns the first attempt's row either way.
INSERT INTO alert_notes (alert_id, author_user_id, idempotency_key, body)
VALUES (@alert_id, @author_user_id, @idempotency_key, @body)
ON CONFLICT (alert_id, author_user_id, idempotency_key) DO NOTHING;

-- name: GetAlertNoteByKey :one
SELECT an.id, an.body, an.created_at, author.name AS author_name
FROM alert_notes an
JOIN users author ON author.id = an.author_user_id
WHERE an.alert_id = @alert_id
  AND an.author_user_id = @author_user_id
  AND an.idempotency_key = @idempotency_key;

-- name: ListAlertNotes :many
SELECT an.id, an.body, an.created_at, author.name AS author_name
FROM alert_notes an
JOIN users author ON author.id = an.author_user_id
WHERE an.alert_id = @alert_id
ORDER BY an.created_at, an.id;

-- name: ListAlertSubjectHistory :many
-- The dispatch history behind a booking-subject alert: the booking's own transition log,
-- read-only. The service renders each row as state codes, never composed prose.
SELECT be.id, be.action, be.from_state, be.to_state, be.created_at
FROM booking_events be
WHERE be.booking_id = @booking_id
ORDER BY be.created_at, be.id;

-- name: GetAlertEscalationContext :one
-- The why-it-fired facts for a BOOKING_ESCALATED alert: the escalation transition itself.
SELECT be.from_state, be.created_at
FROM booking_events be
WHERE be.booking_id = @booking_id AND be.to_state = 'ESCALATED'
ORDER BY be.created_at DESC
LIMIT 1;
