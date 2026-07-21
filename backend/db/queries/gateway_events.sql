-- name: GetGatewayEventStatus :one
-- The dedupe read: has this exact delivery already been applied?
SELECT status FROM payment_gateway_events WHERE gateway_event_id = $1;

-- name: InsertGatewayEvent :exec
-- Idempotent inbox write: a re-delivery of the same gateway_event_id is a no-op.
INSERT INTO payment_gateway_events (provider, event_type, gateway_event_id, reference, provider_ref, payload)
VALUES (@provider, @event_type, @gateway_event_id, @reference, @provider_ref, @payload)
ON CONFLICT (gateway_event_id) DO NOTHING;

-- name: MarkGatewayEventProcessed :exec
UPDATE payment_gateway_events
   SET status = 'PROCESSED', processed_at = now()
 WHERE gateway_event_id = $1;

-- name: ListParkedGatewayEvents :many
-- Events accepted but not yet applied (the webhook beat the payment row). Fed to the replay sweep.
SELECT gateway_event_id, event_type, reference, provider_ref, payload
  FROM payment_gateway_events
 WHERE status = 'RECEIVED'
   AND created_at <= now() - make_interval(mins => sqlc.arg(older_than_minutes)::int)
 ORDER BY created_at
 LIMIT sqlc.arg(max_rows);
