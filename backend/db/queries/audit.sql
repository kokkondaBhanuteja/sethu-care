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
