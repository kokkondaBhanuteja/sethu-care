-- name: InsertAuditLog :exec
-- Write an audit row. Meant to run inside the caller's transaction (pass the same tx) so it commits
-- atomically with the change it records.
INSERT INTO audit_logs (actor_user_id, actor_kind, action, entity_type, entity_id, before, after, correlation_id)
VALUES (@actor_user_id, @actor_kind, @action, @entity_type, @entity_id, @before, @after, @correlation_id);

-- name: AdminListAuditLogs :many
-- The admin console's audit list: entries recorded against bookings by a human ADMIN actor,
-- restricted to the actions the console's audit vocabulary can name (see internal/audit
-- AdminActions). Keyset-paginated newest first. The users join is read-only display data —
-- identity remains the owner of users.
SELECT
  al.id, al.action, al.entity_type, al.entity_id, al.before, al.after, al.created_at,
  admin_user.id   AS admin_id,
  admin_user.name AS admin_name
FROM audit_logs al
JOIN users admin_user ON admin_user.id = al.actor_user_id
WHERE admin_user.role = 'ADMIN'
  AND al.entity_type = 'booking'
  AND al.action = ANY(@actions::text[])
  AND (sqlc.narg('admin_filter')::uuid IS NULL OR al.actor_user_id = sqlc.narg('admin_filter')::uuid)
  AND (sqlc.narg('action_filter')::text IS NULL OR al.action = sqlc.narg('action_filter')::text)
  AND (sqlc.narg('entity_filter')::uuid IS NULL OR al.entity_id = sqlc.narg('entity_filter')::uuid)
  AND (sqlc.narg('from_time')::timestamptz IS NULL OR al.created_at >= sqlc.narg('from_time')::timestamptz)
  AND (sqlc.narg('to_time')::timestamptz IS NULL OR al.created_at < sqlc.narg('to_time')::timestamptz)
  AND (sqlc.narg('cursor_created_at')::timestamptz IS NULL
       OR al.created_at < sqlc.narg('cursor_created_at')::timestamptz
       OR (al.created_at = sqlc.narg('cursor_created_at')::timestamptz
           AND al.id < sqlc.narg('cursor_id')::uuid))
ORDER BY al.created_at DESC, al.id DESC
LIMIT @row_limit::int;

-- name: AdminGetAuditLog :one
-- One audit entry by id, for the detail screen — under the SAME visibility rule as the list
-- (admin actor, booking entity, actions the console vocabulary names), so a deep link can
-- never show more than the list would.
SELECT
  al.id, al.action, al.entity_type, al.entity_id, al.before, al.after, al.created_at,
  admin_user.id   AS admin_id,
  admin_user.name AS admin_name
FROM audit_logs al
JOIN users admin_user ON admin_user.id = al.actor_user_id
WHERE al.id = @id
  AND admin_user.role = 'ADMIN'
  AND al.entity_type = 'booking'
  AND al.action = ANY(@actions::text[]);

-- name: AdminListAuditActors :many
-- The distinct admins present in the audit log, for the filter dropdown — derived here so the
-- console never pages the whole ledger to build a filter. Same visibility rule as the list.
SELECT DISTINCT
  admin_user.id,
  admin_user.name
FROM audit_logs al
JOIN users admin_user ON admin_user.id = al.actor_user_id
WHERE admin_user.role = 'ADMIN'
  AND al.entity_type = 'booking'
  AND al.action = ANY(@actions::text[])
ORDER BY admin_user.name, admin_user.id;

-- name: AdminCountAuditLogs :one
-- Total and timestamp range for the same filter as AdminListAuditLogs (minus the cursor), so
-- the console's "N entries · from – to" line covers the whole result set, not one page.
SELECT
  count(*)::int AS total,
  min(al.created_at)::timestamptz AS range_from,
  max(al.created_at)::timestamptz AS range_to
FROM audit_logs al
JOIN users admin_user ON admin_user.id = al.actor_user_id
WHERE admin_user.role = 'ADMIN'
  AND al.entity_type = 'booking'
  AND al.action = ANY(@actions::text[])
  AND (sqlc.narg('admin_filter')::uuid IS NULL OR al.actor_user_id = sqlc.narg('admin_filter')::uuid)
  AND (sqlc.narg('action_filter')::text IS NULL OR al.action = sqlc.narg('action_filter')::text)
  AND (sqlc.narg('entity_filter')::uuid IS NULL OR al.entity_id = sqlc.narg('entity_filter')::uuid)
  AND (sqlc.narg('from_time')::timestamptz IS NULL OR al.created_at >= sqlc.narg('from_time')::timestamptz)
  AND (sqlc.narg('to_time')::timestamptz IS NULL OR al.created_at < sqlc.narg('to_time')::timestamptz);

-- name: GetAdminActionReplay :one
-- The idempotent-replay record for an admin mutation: the receipt stored under the derived
-- key id (entity_type 'admin_action_key'). Oldest first — the FIRST result is the one a
-- replayed Idempotency-Key must return.
SELECT after
FROM audit_logs
WHERE entity_type = 'admin_action_key' AND entity_id = $1
ORDER BY created_at, id
LIMIT 1;

-- name: CountAdminAuditActionsSince :one
-- How often an admin has performed a booking action recently, plus the oldest occurrence in
-- the window — the refund rate limit's counter and its reset instant. entity_type is pinned
-- to 'booking' so the admin_action_key replay rows (which reuse the action name) never
-- double-count.
SELECT count(*)::int AS total, min(created_at)::timestamptz AS oldest
FROM audit_logs
WHERE actor_user_id = $1
  AND action = $2
  AND entity_type = 'booking'
  AND created_at >= $3;
