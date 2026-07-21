-- name: InsertAuditLog :exec
-- Write an audit row. Meant to run inside the caller's transaction (pass the same tx) so it commits
-- atomically with the change it records.
INSERT INTO audit_logs (actor_user_id, actor_kind, action, entity_type, entity_id, before, after, correlation_id)
VALUES (@actor_user_id, @actor_kind, @action, @entity_type, @entity_id, @before, @after, @correlation_id);
