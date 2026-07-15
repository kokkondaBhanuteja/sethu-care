-- name: InsertOutboxEvent :exec
-- The transactional outbox (ROADMAP §8). Inserted in the SAME transaction as the state
-- change it describes — so either both land or neither does, and a crash between "booking
-- completed" and "ledger notified" cannot lose the event. Delivery is at-least-once; every
-- consumer must be idempotent.
INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload)
VALUES (@aggregate_type, @aggregate_id, @event_type, @payload);

-- name: ClaimUnpublishedOutbox :many
-- The worker's claim. FOR UPDATE SKIP LOCKED is the idiomatic Postgres work-queue: each
-- row the worker reads is locked for the transaction, and SKIP LOCKED means a second worker
-- (or a second poll that overlaps) simply steps over the locked rows to the next free ones.
-- Two workers therefore never dispatch the same event, with no external lock and no queue.
SELECT id, aggregate_type, aggregate_id, event_type, payload, attempts
  FROM outbox
 WHERE published_at IS NULL
 ORDER BY created_at
   FOR UPDATE SKIP LOCKED
 LIMIT $1;

-- name: MarkOutboxPublished :exec
-- Delivered. The partial index outbox_unpublished_idx now excludes this row, so it never
-- comes back — and stays small no matter how many millions have been published.
UPDATE outbox
   SET published_at = now(), updated_at = now()
 WHERE id = $1;

-- name: RecordOutboxFailure :exec
-- A handler refused this event. Record why and count the attempt; the row stays
-- unpublished, so the next poll retries it. This is the at-least-once contract in action.
UPDATE outbox
   SET attempts = attempts + 1, last_error = @last_error, updated_at = now()
 WHERE id = $1;
