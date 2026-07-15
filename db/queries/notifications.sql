-- name: InsertNotification :execrows
-- ON CONFLICT DO NOTHING against the (booking_id, event_type) unique index makes this
-- idempotent: a redelivered event inserts nothing and returns 0 rows affected. No duplicate
-- SMS on a redelivery.
INSERT INTO notification_log (recipient_id, channel, event_type, booking_id, body)
VALUES (@recipient_id, @channel, @event_type, @booking_id, @body)
ON CONFLICT (booking_id, event_type) WHERE booking_id IS NOT NULL DO NOTHING;

-- name: GetNotificationRecipient :one
-- For a booking event, the recipient is the customer.
SELECT u.id, u.name, u.phone
  FROM bookings b
  JOIN users u ON u.id = b.customer_id
 WHERE b.id = $1;
