-- name: InsertOutboxEvent :exec
-- The transactional outbox (ROADMAP §8). Inserted in the SAME transaction as the state
-- change it describes — so either both land or neither does, and a crash between "booking
-- completed" and "ledger notified" cannot lose the event. Delivery is at-least-once; every
-- consumer must be idempotent.
INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload)
VALUES (@aggregate_type, @aggregate_id, @event_type, @payload);

-- name: FetchUnpublishedOutbox :many
-- What the publisher worker reads: everything not yet sent, oldest first. Uses the partial
-- index outbox_unpublished_idx, so it stays fast no matter how many events have been sent.
SELECT id, aggregate_type, aggregate_id, event_type, payload, attempts
  FROM outbox
 WHERE published_at IS NULL
 ORDER BY created_at
 LIMIT $1;
